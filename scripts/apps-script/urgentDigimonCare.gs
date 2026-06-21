const D2_SCHEDULER_SECRET_HEADER = "x-d2-scheduler-secret";

function getUrgentCareConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const config = {
    prepareUrl: properties.getProperty("DIGIMON_URGENT_PREPARE_API_URL"),
    ackUrl: properties.getProperty("DIGIMON_URGENT_ACK_API_URL"),
    secret: properties.getProperty("NOTIFICATION_API_SECRET"),
  };
  if (!config.prepareUrl || !config.ackUrl || !config.secret) {
    throw new Error("긴급 케어 API URL 또는 NOTIFICATION_API_SECRET 설정이 없습니다.");
  }
  return config;
}

function postJson_(url, secret, body) {
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { [D2_SCHEDULER_SECRET_HEADER]: secret },
    payload: JSON.stringify(body || {}),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  let payload = {};
  try {
    payload = JSON.parse(response.getContentText() || "{}");
  } catch (error) {
    throw new Error(`API 응답 JSON 파싱 실패 (${status})`);
  }
  if (status < 200 || status >= 300 || payload.ok !== true) {
    throw new Error(`API 요청 실패 (${status}): ${payload.error || "unknown"}`);
  }
  return payload;
}

function sendUrgentDiscordReport_(report) {
  const response = UrlFetchApp.fetch(report.webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      content: report.messageContent,
      username: "디지몬 파수꾼",
    }),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  return status >= 200 && status < 300;
}

/**
 * 15분 시간 기반 트리거에서 실행한다.
 * Discord 전송에 성공한 delivery만 ack하므로 실패 건은 다음 실행에서 재전송된다.
 */
function notifyUrgentDigimonCare() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log("긴급 케어 알림 실행 생략: 이전 실행이 아직 진행 중입니다.");
    return { ok: false, skipped: true };
  }

  try {
    const config = getUrgentCareConfig_();
    const prepared = postJson_(config.prepareUrl, config.secret, { dryRun: false });
    const reports = Array.isArray(prepared.reports) ? prepared.reports : [];
    const acknowledgedIds = [];
    let failedReports = 0;

    reports.forEach(function (report) {
      try {
        if (sendUrgentDiscordReport_(report)) {
          acknowledgedIds.push.apply(acknowledgedIds, report.deliveryIds || []);
        } else {
          failedReports += 1;
        }
      } catch (error) {
        failedReports += 1;
      }
    });

    let ackSummary = { acknowledged: 0, alreadyAcknowledged: 0, invalid: 0 };
    if (acknowledgedIds.length > 0) {
      ackSummary = postJson_(config.ackUrl, config.secret, {
        deliveryIds: acknowledgedIds,
      });
    }

    const result = {
      ok: true,
      preparedReports: reports.length,
      successfulReports: reports.length - failedReports,
      failedReports: failedReports,
      acknowledged: ackSummary.acknowledged || 0,
      projectionUnavailable: prepared.summary && prepared.summary.projectionUnavailable || 0,
      frozenSlots: prepared.summary && prepared.summary.frozenSlots || 0,
    };
    Logger.log("긴급 케어 알림 결과: " + JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** 전송·delivery 생성 없이 현재 메시지와 집계만 확인한다. */
function dryRunUrgentDigimonCare() {
  const config = getUrgentCareConfig_();
  const prepared = postJson_(config.prepareUrl, config.secret, { dryRun: true });
  const result = {
    generatedAt: prepared.generatedAt,
    summary: prepared.summary,
    reports: (prepared.reports || []).map(function (report) {
      return {
        uid: report.uid,
        tamerName: report.tamerName,
        slotIssues: report.slotIssues,
        messageContent: report.messageContent,
      };
    }),
  };
  Logger.log("긴급 케어 dryRun: " + JSON.stringify(result));
  return result;
}

/** 같은 함수의 기존 트리거를 정리하고 15분 트리거 하나를 만든다. */
function installUrgentDigimonCareTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "notifyUrgentDigimonCare") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("notifyUrgentDigimonCare")
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log("notifyUrgentDigimonCare 15분 트리거를 설치했습니다.");
}
