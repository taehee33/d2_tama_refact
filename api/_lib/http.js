"use strict";

function sendJson(res, status, payload) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    res.status(status).json(payload);
    return;
  }

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendError(res, status, codeOrMessage, messageOrExtra = {}, maybeExtra = {}) {
  if (typeof messageOrExtra === "string") {
    sendJson(res, status, {
      error: {
        code: codeOrMessage,
        message: messageOrExtra,
        ...maybeExtra,
      },
    });
    return;
  }

  sendJson(res, status, {
    error: codeOrMessage,
    ...(messageOrExtra || {}),
  });
}

function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) {
    return true;
  }

  res.setHeader("Allow", methods.join(", "));
  sendError(res, 405, "허용되지 않은 요청 방식입니다.");
  return false;
}

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  sendError(res, 405, "method_not_allowed", "허용되지 않은 요청 방식입니다.", {
    allowedMethods: methods,
  });
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      const parseError = new Error("요청 본문을 JSON으로 해석할 수 없습니다.");
      parseError.status = 400;
      throw parseError;
    }
  }

  const chunks = [];

  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", reject);
  });

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const parseError = new Error("요청 본문을 JSON으로 해석할 수 없습니다.");
    parseError.status = 400;
    throw parseError;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function handleApiError(res, error) {
  if (error?.status) {
    return sendError(res, error.status, error.message);
  }

  if (error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error") {
    return sendError(res, 401, "로그인 인증이 만료되었거나 올바르지 않습니다.");
  }

  console.error("[community-api]", error);
  return sendError(res, 500, error?.message || "커뮤니티 요청을 처리하지 못했습니다.");
}

module.exports = {
  allowMethods,
  getBearerToken,
  handleApiError,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson,
};
