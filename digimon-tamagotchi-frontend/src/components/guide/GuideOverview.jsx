import React from "react";
import { Link } from "react-router-dom";
import { getGroupedGameMenus, MENU_SURFACES } from "../../constants/gameMenus";
import { getCommunityBoardHref } from "../../data/serviceContent";

const START_FLOW = [
  {
    id: "flow-home",
    step: "01",
    title: "홈과 플레이 허브에서 오늘 이어갈 슬롯을 먼저 고릅니다",
    description:
      "최근 슬롯, 단계, 기종 요약이 먼저 보여서 지금 이어볼 슬롯을 빠르게 결정하기 좋습니다.",
  },
  {
    id: "flow-game",
    step: "02",
    title: "게임 안에서는 짧은 케어 루프를 반복합니다",
    description:
      "상태 확인, 먹이, 훈련, 배틀, 교감을 짧게 돌리고 호출과 수면 리듬을 놓치지 않는 것이 기본입니다.",
  },
  {
    id: "flow-notebook",
    step: "03",
    title: "노트북에서 기록과 가이드를 다시 복기합니다",
    description:
      "활동 로그, 배틀 기록, 컬렉션, 가이드가 이어져 있어 플레이 중간에도 맥락을 잃지 않기 쉽습니다.",
  },
  {
    id: "flow-community",
    step: "04",
    title: "커뮤니티는 용도에 맞는 보드로 나눠 씁니다",
    description:
      "가벼운 대화는 자유게시판, 대표 장면은 자랑게시판, 질문과 버그는 버그제보 / QnA 보드가 잘 맞습니다.",
  },
];

const FOCUS_POINTS = [
  "케어 미스, 훈련, 배틀 수와 승률은 진화 판단의 중심 축입니다.",
  "밤 루틴과 조명 관리는 수면 방해와 호출 실수를 크게 줄여 줍니다.",
  "활동 로그와 배틀 기록을 다시 보는 습관이 루틴 수정에 가장 빠르게 도움이 됩니다.",
  "질문과 버그는 지원 보드에 맥락과 이미지까지 남기면 확인 속도가 더 빨라집니다.",
];

const GROWTH_PRINCIPLES = [
  {
    id: "mistakes",
    label: "케어 미스",
    title: "작은 실수 누적이 진화 루트를 바꿉니다",
    body:
      "호출 방치, 수면 중 조명, 수면 방해 같은 항목은 플레이 한 번마다 체감이 작아 보여도 진화 경로에는 꽤 크게 반영됩니다.",
    bullets: [
      "배고픔과 힘 호출을 오래 비워 두지 않기",
      "수면 시간에는 조명 상태를 먼저 확인하기",
      "잘 때는 불필요한 액션으로 깨우지 않기",
    ],
  },
  {
    id: "training",
    label: "훈련",
    title: "훈련 수는 성장 방향을 정리하는 기본 지표입니다",
    body:
      "힘 하트를 채우는 의미뿐 아니라, 누적 훈련 수 자체가 진화 조건에 들어가는 경우가 많아서 꾸준히 쌓아 두는 편이 좋습니다.",
    bullets: [
      "훈련 4회마다 노력치 하트가 올라갑니다",
      "체중 정리와 배틀 준비를 같이 챙길 수 있습니다",
      "많은 경로에서 훈련 수가 핵심 조건으로 쓰입니다",
    ],
  },
  {
    id: "battle",
    label: "배틀",
    title: "후반 진화는 배틀 수와 승률을 같이 봐야 합니다",
    body:
      "배틀 횟수만 채운다고 끝나지 않고, 승률이 같이 따라와야 원하는 루트가 열리는 경우가 많습니다.",
    bullets: [
      "배틀 수만 채우지 말고 승률도 같이 보기",
      "부상은 바로 치료해서 누적 리스크 줄이기",
      "프로틴 과다와 패배 루프가 겹치지 않게 관리하기",
    ],
  },
  {
    id: "records",
    label: "기록",
    title: "기록을 다시 보는 습관이 루틴 수정에 가장 빠릅니다",
    body:
      "활동 로그와 배틀 기록, 노트북 흐름이 이어져 있어 어떤 시점부터 리듬이 흔들렸는지 되짚기 쉬워졌습니다.",
    bullets: [
      "배틀 기록으로 승률 흐름 확인하기",
      "활동 로그로 수면과 호출 타이밍 복기하기",
      "중요 장면은 자랑게시판이나 노트북에 남겨 두기",
    ],
  },
];

const COMMUNITY_GUIDES = [
  {
    id: "free",
    label: "자유게시판",
    title: "근황, 짧은 질문, 공략 메모를 빠르게 나누는 곳",
    description:
      "말머리 `일반 / 질문 / 공략` 중심의 텍스트 보드라 읽는 속도가 빠르고, 이미지 1장도 함께 남길 수 있습니다.",
    href: getCommunityBoardHref("free"),
    action: "자유게시판 보기",
  },
  {
    id: "showcase",
    label: "자랑게시판",
    title: "대표 장면과 성장 로그를 기록하는 곳",
    description:
      "대화보다는 장면과 수치 기록을 남기기에 더 적합한 피드입니다. 보관 가치가 큰 글을 남길 때 잘 어울립니다.",
    href: getCommunityBoardHref("showcase"),
    action: "자랑게시판 보기",
  },
  {
    id: "support",
    label: "버그제보 / QnA",
    title: "질문, 버그 제보, 해결 기록을 정리하는 곳",
    description:
      "말머리 `버그 / 질문 / 해결`과 함께 슬롯 번호, 화면 경로, 버전, 이미지까지 같이 남길 수 있어 확인 흐름이 분명합니다.",
    href: getCommunityBoardHref("support"),
    action: "버그제보 / QnA 보기",
  },
];

const GUIDE_FAQS = [
  {
    id: "faq-1",
    question: "이 페이지에서 먼저 보면 좋은 구간은 어디인가요?",
    answer:
      "처음에는 `현재 사이트 기준으로 보는 전체 흐름`과 `게임 안 메뉴 구조`만 먼저 읽어도 충분합니다. 실제 플레이 중 세부 진화 조건은 게임 안 가이드 버튼과 노트북에서 다시 확인하는 흐름이 자연스럽습니다.",
  },
  {
    id: "faq-2",
    question: "자유게시판과 버그제보 / QnA는 어떻게 나눠 쓰면 좋나요?",
    answer:
      "가벼운 대화, 짧은 질문, 공략 메모는 자유게시판이 잘 맞고, 재현 정보나 상태 맥락이 필요한 질문과 버그는 버그제보 / QnA 보드가 더 잘 맞습니다.",
  },
  {
    id: "faq-3",
    question: "대표 장면과 로그는 어디에 남기는 게 좋나요?",
    answer:
      "나중에 다시 꺼내 볼 가치가 큰 장면과 성장 로그는 자랑게시판이 더 어울립니다. 텍스트 대화와 보관용 기록을 분리해 두면 흐름이 훨씬 깔끔합니다.",
  },
];

function formatMenuLabels(group) {
  return group.menus.map((menu) => menu.label).join(" · ");
}

function buildServiceAreas(currentUser) {
  return [
    {
      id: "play",
      label: "플레이와 기록",
      title: "홈, 플레이 허브, 노트북이 한 흐름으로 이어집니다",
      description:
        "최근 슬롯 요약으로 진입하고, 게임 안 로그와 노트북 복기로 다시 돌아오는 구조가 지금 서비스의 기본 흐름입니다.",
      links: [
        {
          label: currentUser ? "플레이 허브" : "로그인",
          href: currentUser ? "/play" : "/auth",
        },
        {
          label: "노트북",
          href: "/notebook",
        },
      ],
    },
    {
      id: "community",
      label: "커뮤니티",
      title: "대화형 보드와 기록형 피드가 역할별로 분리돼 있습니다",
      description:
        "자유게시판은 읽기 속도 중심, 자랑게시판은 보관형 기록, 버그제보 / QnA는 지원 흐름 중심으로 설계돼 있습니다.",
      links: [
        {
          label: "자유게시판",
          href: getCommunityBoardHref("free"),
        },
        {
          label: "지원 보드",
          href: getCommunityBoardHref("support"),
        },
      ],
    },
    {
      id: "settings",
      label: "테이머(설정)",
      title: "서비스 전체 분위기와 사용 감각을 조정하는 공간입니다",
      description:
        "테마와 일반 페이지 분위기를 바꾸는 설정이 모여 있어 현재 서비스 셸의 톤을 다듬는 중심 구간으로 쓰입니다.",
      links: [
        {
          label: currentUser ? "설정 보기" : "로그인",
          href: currentUser ? "/me/settings" : "/auth",
        },
      ],
    },
  ];
}

function GuideOverview({ currentUser }) {
  const primaryMenuGroups = getGroupedGameMenus(MENU_SURFACES.PRIMARY);
  const extraMenuGroups = getGroupedGameMenus(MENU_SURFACES.EXTRA);
  const serviceAreas = buildServiceAreas(currentUser);

  return (
    <div className="guide-page-layout">
      <section className="service-card guide-flow-panel">
        <div className="guide-flow-panel__column">
          <p className="service-section-label">Flow</p>
          <h2>현재 사이트 기준으로 보는 전체 흐름</h2>
          <div className="guide-timeline">
            {START_FLOW.map((item) => (
              <article key={item.id} className="guide-timeline__item">
                <span className="guide-timeline__step">{item.step}</span>
                <div className="guide-timeline__body">
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="guide-flow-panel__column guide-flow-panel__column--accent">
          <p className="service-section-label">Focus</p>
          <h3>지금 가장 중요한 기준</h3>
          <ul className="guide-focus-list">
            {FOCUS_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="service-card service-card--mint guide-section-card">
        <p className="service-section-label">Site Structure</p>
        <h2>플레이·기록·설정 페이지 역할</h2>
        <p className="service-muted">
          페이지 수는 늘었지만 역할은 더 단순해졌습니다. 어떤 정보가 어디에 모이는지만 기억하면
          전체 구조가 훨씬 편해집니다.
        </p>
        <div className="guide-area-grid">
          {serviceAreas.map((area) => (
            <article key={area.id} className="guide-area-card">
              <span className="guide-area-card__label">{area.label}</span>
              <strong>{area.title}</strong>
              <p>{area.description}</p>
              <div className="guide-link-row">
                {area.links.map((link) => (
                  <Link key={`${area.id}-${link.href}`} className="service-text-link" to={link.href}>
                    {link.label} →
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="service-card guide-section-card">
        <p className="service-section-label">Menu Structure</p>
        <h2>게임 안 메뉴 구조</h2>
        <div className="guide-menu-summary">
          <article className="guide-menu-summary__group">
            <span className="guide-menu-summary__label">기본 조작</span>
            {primaryMenuGroups.map((group) => (
              <div key={group.id} className="guide-menu-summary__block">
                <strong>{group.label}</strong>
                <p>{formatMenuLabels(group)}</p>
              </div>
            ))}
          </article>

          <article className="guide-menu-summary__group">
            <span className="guide-menu-summary__label">더보기 안</span>
            {extraMenuGroups.map((group) => (
              <div key={group.id} className="guide-menu-summary__block">
                <strong>{group.label}</strong>
                <p>{formatMenuLabels(group)}</p>
              </div>
            ))}
          </article>
        </div>
      </section>

      <section className="service-card service-card--warm guide-section-card">
        <p className="service-section-label">Growth Notes</p>
        <h2>육성 판단 포인트</h2>
        <div className="guide-accordion-list">
          {GROWTH_PRINCIPLES.map((item) => (
            <details key={item.id} className="guide-accordion-item">
              <summary>
                <span className="guide-accordion-item__label">{item.label}</span>
                <strong>{item.title}</strong>
              </summary>
              <p>{item.body}</p>
              <ul className="guide-bullet-list">
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section className="service-card service-card--soft guide-section-card">
        <p className="service-section-label">Community</p>
        <h2>커뮤니티 보드 활용</h2>
        <div className="guide-board-grid">
          {COMMUNITY_GUIDES.map((board) => (
            <article key={board.id} className="guide-board-card">
              <span className="guide-board-card__label">{board.label}</span>
              <strong>{board.title}</strong>
              <p>{board.description}</p>
              <Link className="service-text-link" to={board.href}>
                {board.action} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="service-card guide-section-card">
        <p className="service-section-label">FAQ</p>
        <h2>자주 막히는 지점</h2>
        <div className="guide-faq-list">
          {GUIDE_FAQS.map((faq) => (
            <details key={faq.id} className="guide-faq-item">
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

export default GuideOverview;
