"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// 병원 정보를 포함한 대화 기록 타입입니다.
interface ConversationRecord {
  status: "진행중" | "완료";
  title: string;
  date: string;
  hospital: string;
  summary?: string;
  messages?: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    status: "pending" | "done" | "error";
    createdAt: number;
  }>;
  lastUpdatedAt?: number;
}

const PAGE_SIZE = 8;
const SUMMARY_SECTIONS = [
  {
    key: "과거 사건",
    label: "과거 사건",
  },
  {
    key: "인지 사고",
    label: "인지 사고",
  },
  {
    key: "감정 반응",
    label: "감정 반응",
  },
  {
    key: "대안 사고",
    label: "대안 사고",
  },
  {
    key: "환자 상태 요약 리포트 (CAMS-SSF-4 기반)",
    label: "환자 상태 요약 리포트 (CAMS-SSF-4 기반)",
  },
  {
    key: "심리적 고통 (Pain)",
    label: "심리적 고통 (Pain)",
  },
  {
    key: "절망감 (Hopelessness)",
    label: "절망감 (Hopelessness)",
  },
  {
    key: "자기 비하 (Self-Hate)",
    label: "자기 비하 (Self-Hate)",
  },
  {
    key: "주요 스트레스원(S)",
    label: "주요 스트레스원(S)",
  },
  {
    key: "주요 호소 내용 (환자 어록)",
    label: "주요 호소 내용 (환자 어록)",
  },
  {
    key: "감정(E)",
    label: "감정(E)",
  },
  {
    key: "생각(T)",
    label: "생각(T)",
  },
];

// 한국어 주석: 요약 문자열을 화면 표시용 섹션 배열로 변환합니다.
function parseSummarySections(summary?: string) {
  const baseSections = SUMMARY_SECTIONS.map((section) => ({
    ...section,
    content: "",
  }));

  if (!summary || typeof summary !== "string") {
    return baseSections;
  }

  // 한국어 주석: 요약 문자열 내에서 각 키의 위치를 찾아내기 위한 정규식을 구성합니다.
  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyMatchers = SUMMARY_SECTIONS.map((section) =>
    escapeRegExp(section.key)
  );
  const pattern = new RegExp(`(?:●\\s*)?(?:${keyMatchers.join("|")})`, "g");
  const validKeys = new Set(SUMMARY_SECTIONS.map((section) => section.key));
  const matches: Array<{ key: string; index: number; length: number }> = [];

  for (const match of summary.matchAll(pattern)) {
    const matchedKey = match[0].replace(/^●\s*/, "");
    if (validKeys.has(matchedKey)) {
      matches.push({
        key: matchedKey,
        index: match.index ?? 0,
        length: match[0].length,
      });
    }
  }

  if (!matches.length) {
    return baseSections;
  }

  matches.sort((a, b) => a.index - b.index);

  const contentMap = new Map<string, string>();

  // 한국어 주석: 매칭된 각 구간 사이에서 값을 추출하며 불필요한 기호를 제거합니다.
  matches.forEach((currentMatch, idx) => {
    const start = currentMatch.index + currentMatch.length;
    const end =
      idx < matches.length - 1 ? matches[idx + 1].index : summary.length;
    const rawValue = summary.slice(start, end);
    const formattedValue = rawValue
      .replace(/^[\s:]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (formattedValue.length > 0) {
      const previous = contentMap.get(currentMatch.key);
      const merged = previous
        ? `${previous}\n${formattedValue}`
        : formattedValue;
      contentMap.set(currentMatch.key, merged);
    }
  });

  return baseSections.map((section) => ({
    ...section,
    content: contentMap.get(section.key) ?? "",
  }));
}

export default function DashboardPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [records, setRecords] = useState<ConversationRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<ConversationRecord | null>(
    null
  ); // 한국어 주석: 모달에 표시할 대화 기록을 추적합니다.
  const [isModalOpen, setIsModalOpen] = useState(false); // 한국어 주석: 모달의 열림/닫힘 상태를 관리합니다.
  const [isModalVisible, setIsModalVisible] = useState(false); // 한국어 주석: 모달 애니메이션을 위한 가시 상태를 관리합니다.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 한국어 주석: 닫기 애니메이션 후 상태 정리를 위한 타이머를 보관합니다.
  const summarySectionsForActiveRecord = activeRecord
    ? parseSummarySections(activeRecord.summary)
    : [];
  const hasSummaryContent = summarySectionsForActiveRecord.some(
    (section) => section.content && section.content.length > 0
  );
  const formattedSummarySections = summarySectionsForActiveRecord
    .filter((section) => section.content && section.content.length > 0)
    .reduce<
      Array<
        | {
            type: "heading";
            id: string;
            label: string;
          }
        | {
            type: "section";
            id: string;
            section: (typeof summarySectionsForActiveRecord)[number];
          }
      >
    >((acc, section) => {
      // 한국어 주석: 특정 인덱스 기반으로 큰 제목을 삽입하여 가독성을 높입니다.
      if (section.key === "과거 사건") {
        acc.push({
          type: "heading",
          id: "insight-analysis",
          label: "인지 행동 분석",
        });
      }
      if (section.key === "심리적 고통 (Pain)") {
        acc.push({
          type: "heading",
          id: "cams-summary",
          label: "환자 상태 요약 리포트 (CAMS-SSF-4 기반)",
        });
      }
      if (section.key === "감정(E)") {
        acc.push({
          type: "heading",
          id: "complaints",
          label: "주요 호소 내용",
        });
      }
      acc.push({
        type: "section",
        id: section.key,
        section,
      });
      return acc;
    }, []);

  useEffect(() => {
    // 브라우저 캐시에 저장된 대화 기록을 불러옵니다.
    try {
      const storedRecords = window.localStorage.getItem("conversationRecords");
      if (!storedRecords) {
        setRecords([]);
        return;
      }

      const parsed = JSON.parse(storedRecords);

      if (Array.isArray(parsed)) {
        // 한국어 주석: 캐시에 잘못된 값이 섞여 있어도 화면이 깨지지 않도록 필터링합니다.
        setRecords(
          parsed.filter(
            (record: ConversationRecord) =>
              record &&
              typeof record === "object" &&
              typeof record.status === "string" &&
              typeof record.title === "string" &&
              typeof record.date === "string" &&
              typeof record.hospital === "string"
          )
        );
      } else {
        setRecords([]);
      }
    } catch (error) {
      // JSON 파싱 오류 등으로 캐시를 읽지 못했을 때 기본값을 사용합니다.
      setRecords([]);
    }
  }, []);

  const handleStatusToggle = (absoluteIndex: number) => {
    // 한국어 주석: 상태를 진행중 ↔ 완료로 토글하고 로컬 스토리지에 반영합니다.
    setRecords((prev) => {
      const target = prev[absoluteIndex];
      if (!target) {
        return prev;
      }
      const next = [...prev];
      next[absoluteIndex] = {
        ...target,
        status: target.status === "진행중" ? "완료" : "진행중",
      };
      try {
        window.localStorage.setItem(
          "conversationRecords",
          JSON.stringify(next)
        );
      } catch (error) {
        console.error("대화 기록 상태를 저장하지 못했습니다:", error);
      }
      return next;
    });
  };

  const handleOpenModal = (record: ConversationRecord) => {
    // 한국어 주석: 모달을 열 때 확대 애니메이션이 잘 동작하도록 초기 상태를 설정합니다.
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveRecord(record);
    setIsModalOpen(true);
    requestAnimationFrame(() => {
      // 한국어 주석: 다음 렌더 프레임에서 가시 상태를 true로 변경해 확대 애니메이션을 유도합니다.
      setIsModalVisible(true);
    });
  };

  const handleCloseModal = () => {
    // 한국어 주석: 모달을 닫을 때 축소 애니메이션이 끝난 뒤 상태를 초기화합니다.
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsModalVisible(false);
    closeTimerRef.current = setTimeout(() => {
      setIsModalOpen(false);
      setActiveRecord(null);
      closeTimerRef.current = null;
    }, 100);
  };

  useEffect(() => {
    // 한국어 주석: 컴포넌트가 언마운트될 때 남은 타이머를 정리합니다.
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // 한국어 주석: ESC 누를 때 모달이 열려 있으면 닫습니다.
    if (!isModalOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  useEffect(() => {
    // 대화 기록 수가 변경되면 페이지 위치를 안전하게 보정합니다.
    setPageIndex((prev) => {
      const maxPageIndex = Math.max(
        0,
        Math.ceil(records.length / PAGE_SIZE) - 1
      );
      return Math.min(prev, maxPageIndex);
    });
  }, [records]);

  const paginatedRecords = records.slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE
  );
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));

  return (
    <div className="flex flex-1">
      <div className="p-2 md:p-10 rounded-tl-2xl border border-neutral-200 bg-white flex flex-col gap-6 flex-1 w-full h-full">
        <h1 className="text-2xl font-bold">대화 기록</h1>
        <section className="flex flex-col gap-4 justify-between h-full">
          <div className="flex flex-col gap-3">
            <span className="text-sm text-neutral-500 self-end">
              총 {records.length}건
            </span>
            {paginatedRecords.map((record, index) => (
              <article
                key={`${record.title}-${record.date}-${index}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 shadow-sm hover:cursor-pointer"
                onClick={() => {
                  // 한국어 주석: 목록 항목을 선택하면 모달을 띄워 상세 내용을 보여줍니다.
                  handleOpenModal(record);
                }}
              >
                <div className="flex flex-row gap-10">
                  <span className="text-sm font-medium text-neutral-500 w-12">
                    <button
                      type="button"
                      className="w-full text-center p-1 hover:text-neutral-800"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStatusToggle(pageIndex * PAGE_SIZE + index);
                      }}
                    >
                      {record.status}
                    </button>
                  </span>
                  <span className="text-base font-semibold text-neutral-900">
                    {record.title}
                  </span>
                </div>
                <div className="flex flex-row gap-10">
                  <span className="text-sm text-neutral-600">
                    {record.hospital}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {record.date}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <footer className="flex items-center justify-between pt-2">
            <span className="text-sm text-neutral-500">
              {pageIndex + 1} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-neutral-200 px-3 py-1 text-sm font-medium text-neutral-600 disabled:opacity-40"
                onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
                disabled={pageIndex === 0}
              >
                이전
              </button>
              <button
                className="rounded-md border border-neutral-200 px-3 py-1 text-sm font-medium text-neutral-600 disabled:opacity-40"
                onClick={() =>
                  setPageIndex((prev) => Math.min(prev + 1, totalPages - 1))
                }
                disabled={pageIndex >= totalPages - 1}
              >
                다음
              </button>
            </div>
          </footer>
        </section>
      </div>

      {isModalOpen && activeRecord && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-300 ${
            isModalVisible ? "bg-black/50 opacity-100" : "bg-black/0 opacity-0"
          }`}
          onClick={() => {
            // 한국어 주석: 오버레이를 클릭하면 모달을 닫아 사용자 경험을 높입니다.
            handleCloseModal();
          }}
        >
          <div
            className={`relative flex h-[90%] w-[90%] max-w-6xl flex-row rounded-2xl bg-white shadow-2xl transition-transform duration-300 ${
              isModalVisible ? "scale-100" : "scale-90"
            }`}
            onClick={(event) => {
              // 한국어 주석: 내부 콘텐츠를 클릭했을 때 오버레이 클릭 이벤트가 전파되지 않도록 막습니다.
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="absolute right-4 top-4 text-sm font-semibold text-neutral-500 hover:text-neutral-700 hover:cursor-pointer"
              onClick={() => {
                // 한국어 주석: 닫기 버튼을 클릭하면 모달을 닫습니다.
                handleCloseModal();
              }}
            >
              <X className="w-8 h-8" />
            </button>
            <section className="flex w-1/2 flex-col  p-6">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-neutral-800">
                  {activeRecord.title}
                </h2>
                <p className="text-sm text-neutral-500">
                  {activeRecord.date} · {activeRecord.hospital}
                </p>
              </header>
              <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                {Array.isArray(activeRecord.messages) &&
                activeRecord.messages.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {activeRecord.messages.map((message) => (
                      <article
                        key={message.id}
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          message.role === "user"
                            ? "self-end bg-brand-gradient text-white"
                            : "self-start bg-white text-neutral-800 shadow-sm ring-1 ring-black/5"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    저장된 대화 메시지가 없습니다.
                  </p>
                )}
              </div>
            </section>
            <section className="flex w-1/2 flex-col p-6 pt-22">
              <div className="flex h-full flex-col rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex-1 overflow-y-auto">
                  {hasSummaryContent ? (
                    <div className="flex flex-col gap-2">
                      {formattedSummarySections.map((item) =>
                        item.type === "heading" ? (
                          <div key={item.id}>
                            <h2 className="text-lg font-bold text-neutral-900 mt-2">
                              {item.label}
                            </h2>
                          </div>
                        ) : (
                          <div key={item.id} className="flex flex-col">
                            <h3 className="text-sm font-semibold text-neutral-900">
                              {item.section.label}
                            </h3>
                            <p className="whitespace-pre-wrap text-sm text-neutral-700">
                              {item.section.content}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm leading-7 text-neutral-600">
                      요약 정보가 존재하지 않습니다.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
