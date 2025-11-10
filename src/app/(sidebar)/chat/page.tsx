"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, Send, Sparkles, X } from "lucide-react";
import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  type RealtimeItem,
  type RealtimeMessageItem,
} from "@openai/agents/realtime";
import { TextGenerateEffect } from "@/components/ui/text-generation-effect";
import ShaderBackground from "@/components/ui/shader-background";

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: "pending" | "done" | "error";
  createdAt: number;
}

// 한국어 주석: 대시보드에서 활용할 저장용 대화 기록 타입입니다.
interface StoredConversationRecord {
  status: "진행중" | "완료";
  title: string;
  date: string;
  hospital: string;
  summary: string;
  messages: ChatMessage[];
  lastUpdatedAt: number;
}

// 고유 메시지 ID를 생성하는 헬퍼입니다.
const generateMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// 역할과 내용을 기반으로 대화 메시지 객체를 만들어줍니다.
const createChatMessage = (
  partial: Omit<ChatMessage, "id" | "createdAt">
): ChatMessage => ({
  id: generateMessageId(),
  createdAt: Date.now(),
  ...partial,
});

// OpenAPI 연동을 위해 메시지 페이로드를 정의합니다.
interface ChatCompletionPayload {
  model?: string;
  messages: Array<{
    role: ChatRole;
    content: string;
  }>;
}

// OpenAPI 호출에 사용할 기본 엔드포인트와 모델 정보를 정의합니다.
const CHAT_ENDPOINT = "/api/chat";
const CHAT_MODEL = process.env.NEXT_PUBLIC_OPENAPI_MODEL ?? "gpt-4.1-mini";
const REALTIME_MODEL =
  process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ??
  "gpt-4o-mini-realtime-preview";
const REALTIME_VOICE = process.env.NEXT_PUBLIC_OPENAI_VOICE ?? "alloy";
const REALTIME_TRANSCRIBE_MODEL =
  process.env.NEXT_PUBLIC_OPENAI_STT_MODEL ?? "gpt-4o-mini-transcribe";
const REALTIME_BASE_URL =
  process.env.NEXT_PUBLIC_OPENAI_REALTIME_BASE_URL ??
  "https://api.openai.com/v1/realtime";
const SETTINGS_STORAGE_KEY = "settingFormData";
const CONVERSATION_STORAGE_KEY = "conversationRecords";
const BASE_SYSTEM_PROMPT = `당신은 자살 시도 이후 응급하게 병원에 입원한 환자의 상담사입니다.
당신의 목표는 환자의 정서를 안정시키고, 환자가 겪었던 사건을 파악하고 공감하는 것입니다.
공감한 이후에는 환자의 사고(생각)과 감정을 파악하여 환자의 인지적 왜곡을 찾고, 이를 해결하는 것입니다.
모든 답변은 JSON 포맷으로 {message: string, score: int}로 score에는 환자의 부정적 감정의 정도를 100점 만점으로 평가하여 넣어주세요.`;
const BASE_SYSTEM_PROMPT_VOICE = `당신은 자살 시도 이후 응급하게 병원에 입원한 환자의 상담사입니다.
당신의 목표는 환자의 정서를 안정시키고, 환자가 겪었던 사건을 파악하고 공감하는 것입니다.
공감한 이후에는 환자의 사고(생각)과 감정을 파악하여 환자의 인지적 왜곡을 찾고, 이를 해결하는 것입니다.
한국어만을 사용하여 대화를 진행합니다.`;

// 한국어 주석: 심호흡 안내 단계별 텍스트와 지속 시간을 정의합니다.
const BREATHING_SEQUENCE = [
  {
    key: "calm",
    text: "많이 흥분하셨네요.",
    duration: 2000,
    circle: "idle" as const,
  },
  {
    key: "prepare",
    text: "같이 심호흡을 해볼까요?",
    duration: 2000,
    circle: "idle" as const,
  },
  {
    key: "inhale",
    text: "5초 동안 들이마시기",
    duration: 5000,
    circle: "inhale" as const,
  },
  {
    key: "hold",
    text: "5초 동안 숨 참기",
    duration: 5000,
    circle: "hold" as const,
  },
  {
    key: "exhale",
    text: "5초 동안 내쉬기",
    duration: 5000,
    circle: "exhale" as const,
  },
] as const;

// 한국어 주석: 요약 생성 흐름의 상태를 표현합니다.
type SummaryStatus = "idle" | "loading" | "ready" | "error";

interface ConversationSummaryState {
  status: SummaryStatus;
  title: string;
  summary: string;
  error?: string;
}

// 한국어 주석: 심호흡 안내 오버레이의 상태를 추적합니다.
interface BreathingGuideState {
  isActive: boolean;
  isVisible: boolean;
  isOpaque: boolean;
  stepIndex: number;
  cycle: number;
}

// 한국어 주석: 간호사 호출 알림 상태를 정의합니다.
interface NurseAlertState {
  isVisible: boolean;
  isOpaque: boolean;
}

export default function ChatPage() {
  // 사용자가 보낸 메시지와 모델 응답을 보관합니다.
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createChatMessage({
      role: "assistant",
      content:
        "안녕하세요! 당신의 이야기가 듣고 싶어요. 무엇이 당신을 힘들게 했나요?",
      status: "done",
    }),
  ]);
  // 텍스트 영역 입력값을 추적합니다.
  const [inputValue, setInputValue] = useState("");
  // 시스템 프롬프트 내용을 관리합니다.
  const [promptValue, setPromptValue] = useState(BASE_SYSTEM_PROMPT);
  const [promptValueVoice, setPromptValueVoice] = useState(
    BASE_SYSTEM_PROMPT_VOICE
  );
  // 비동기 요청 진행 여부를 추적합니다.
  const [isLoading, setIsLoading] = useState(false);
  // 마지막 오류 메시지를 사용자에게 보여주기 위해 저장합니다.
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  // 스크롤 하단으로 자동 이동시킬 컨테이너 참조입니다.
  const messageContainerRef = useRef<HTMLDivElement>(null);
  // 텍스트 영역 높이를 자동으로 조절하기 위한 참조입니다.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 엔터 키로 제출하기 위한 폼 참조입니다.
  const formRef = useRef<HTMLFormElement>(null);
  // 음성 세션 연결 상태를 추적합니다.
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  // 음성 세션 연결 시도 진행 여부를 추적합니다.
  const [isRealtimeConnecting, setIsRealtimeConnecting] = useState(false);
  // Realtime 세션 인스턴스를 저장합니다.
  const realtimeSessionRef = useRef<RealtimeSession | null>(null);
  // WebRTC 전송 레이어 인스턴스를 저장합니다.
  const realtimeTransportRef = useRef<OpenAIRealtimeWebRTC | null>(null);
  // 음성 대화 히스토리를 채팅 메시지와 동기화하기 위한 캐시입니다.
  const voiceMessageCacheRef = useRef<Map<string, ChatMessage>>(new Map());
  // 현재 세션에서 사용 중인 음성 메시지 ID 목록을 추적합니다.
  const voiceMessageIdsRef = useRef<Set<string>>(new Set());
  const voiceHistoryLogRef = useRef<ChatMessage[]>([]); // 한국어 주석: 콘솔 출력용 음성 대화 히스토리를 임시 저장합니다.
  // 원격 음성 출력을 재생할 오디오 엘리먼트를 관리합니다.
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasPersistedRef = useRef(false);
  const latestPersistableStateRef = useRef<{
    messages: ChatMessage[];
    hospitalName: string;
    summary: ConversationSummaryState;
  }>({
    messages: [],
    hospitalName: "",
    summary: { status: "idle", title: "", summary: "" },
  });

  // 한국어 주석: 설정에서 가져온 병원명과 GPT 요약 상태를 기억합니다.
  const [hospitalName, setHospitalName] = useState("");
  const [summaryState, setSummaryState] = useState<ConversationSummaryState>({
    status: "idle",
    title: "",
    summary: "",
  });
  const summaryControllerRef = useRef<AbortController | null>(null);
  const [settingSnapshot, setSettingSnapshot] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [breathingGuideState, setBreathingGuideState] =
    useState<BreathingGuideState>({
      isActive: false,
      isVisible: false,
      isOpaque: false,
      stepIndex: 0,
      cycle: 0,
    }); // 한국어 주석: 심호흡 오버레이가 진행 중인지 추적합니다.
  const breathingStepTimeoutRef = useRef<number | null>(null); // 한국어 주석: 단계 전환 타이머 ID를 저장합니다.
  const breathingOpacityTimeoutRef = useRef<number | null>(null); // 한국어 주석: 페이드 인·아웃 타이머 ID를 기억합니다.
  const [nurseAlertState, setNurseAlertState] = useState<NurseAlertState>({
    isVisible: false,
    isOpaque: false,
  }); // 한국어 주석: 간호사 호출 안내 표시 여부를 관리합니다.
  const nurseAlertTimeoutsRef = useRef<number[]>([]); // 한국어 주석: 간호사 알림 관련 타이머 ID 목록입니다.

  const startBreathingGuide = () => {
    // 한국어 주석: 감정이 가라앉을 수 있도록 심호흡 안내를 초기화합니다.
    if (typeof window === "undefined") {
      return;
    }

    if (breathingStepTimeoutRef.current) {
      window.clearTimeout(breathingStepTimeoutRef.current);
      breathingStepTimeoutRef.current = null;
    }

    if (breathingOpacityTimeoutRef.current) {
      window.clearTimeout(breathingOpacityTimeoutRef.current);
      breathingOpacityTimeoutRef.current = null;
    }

    setBreathingGuideState({
      isActive: true,
      isVisible: true,
      isOpaque: false,
      stepIndex: 0,
      cycle: 0,
    });

    breathingOpacityTimeoutRef.current = window.setTimeout(() => {
      setBreathingGuideState((prev) => {
        if (!prev.isVisible) {
          return prev;
        }
        return { ...prev, isOpaque: true };
      });
      breathingOpacityTimeoutRef.current = null;
    }, 2000);
  };

  // 이전 메시지를 기반으로 OpenAPI에 전달할 페이로드를 생성합니다.
  const formattedMessagesForApi = useMemo(() => {
    // 한국어 주석: 시스템 프롬프트를 최상단에 배치해 모델 행동을 제어합니다.
    const baseMessages =
      promptValue.trim().length > 0
        ? [
            {
              role: "system" as ChatRole,
              content: promptValue.trim(),
            },
          ]
        : [];

    const historyMessages = messages
      .filter((message) => message.status === "done")
      .map(({ role, content }) => ({
        role,
        content,
      }));

    return [...baseMessages, ...historyMessages];
  }, [messages, promptValue]);

  useEffect(() => {
    // 새로운 메시지가 추가되면 스크롤을 하단으로 이동시킵니다.
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTo({
        top: messageContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEffect(() => {
    // 한국어 주석: 심호흡 안내 단계가 진행되도록 타이머를 관리합니다.
    if (!breathingGuideState.isActive) {
      return;
    }
    const currentStep = BREATHING_SEQUENCE[breathingGuideState.stepIndex];
    if (!currentStep || typeof window === "undefined") {
      return;
    }

    if (breathingStepTimeoutRef.current) {
      window.clearTimeout(breathingStepTimeoutRef.current);
    }

    breathingStepTimeoutRef.current = window.setTimeout(() => {
      setBreathingGuideState((prev) => {
        if (!prev.isActive) {
          return prev;
        }
        const isLastStep = prev.stepIndex >= BREATHING_SEQUENCE.length - 1;
        if (isLastStep) {
          const isFinalCycle = prev.cycle >= 2;
          if (isFinalCycle) {
            return {
              ...prev,
              isActive: false,
              isOpaque: false,
            };
          }
          return {
            ...prev,
            stepIndex: 0,
            cycle: prev.cycle + 1,
          };
        }
        return {
          ...prev,
          stepIndex: prev.stepIndex + 1,
        };
      });
    }, currentStep.duration);

    return () => {
      if (breathingStepTimeoutRef.current) {
        window.clearTimeout(breathingStepTimeoutRef.current);
        breathingStepTimeoutRef.current = null;
      }
    };
  }, [
    breathingGuideState.isActive,
    breathingGuideState.stepIndex,
    breathingGuideState.cycle,
  ]);

  useEffect(() => {
    // 한국어 주석: 페이드 아웃이 끝나면 심호흡 오버레이를 제거합니다.
    if (
      breathingGuideState.isActive ||
      !breathingGuideState.isVisible ||
      breathingGuideState.isOpaque ||
      typeof window === "undefined"
    ) {
      return;
    }

    if (breathingOpacityTimeoutRef.current) {
      window.clearTimeout(breathingOpacityTimeoutRef.current);
    }

    breathingOpacityTimeoutRef.current = window.setTimeout(() => {
      setBreathingGuideState({
        isActive: false,
        isVisible: false,
        isOpaque: false,
        stepIndex: 0,
        cycle: 0,
      });
      breathingOpacityTimeoutRef.current = null;
    }, 2000);

    return () => {
      if (breathingOpacityTimeoutRef.current) {
        window.clearTimeout(breathingOpacityTimeoutRef.current);
        breathingOpacityTimeoutRef.current = null;
      }
    };
  }, [
    breathingGuideState.isActive,
    breathingGuideState.isVisible,
    breathingGuideState.isOpaque,
  ]);

  useEffect(() => {
    // 한국어 주석: 컴포넌트가 종료될 때 타이머를 정리합니다.
    return () => {
      if (typeof window === "undefined") {
        return;
      }
      if (breathingStepTimeoutRef.current) {
        window.clearTimeout(breathingStepTimeoutRef.current);
      }
      if (breathingOpacityTimeoutRef.current) {
        window.clearTimeout(breathingOpacityTimeoutRef.current);
      }
      nurseAlertTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId)
      );
      nurseAlertTimeoutsRef.current = [];
    };
  }, []);

  const showNurseAlert = () => {
    // 한국어 주석: 긴급 상황 안내를 크게 표시합니다.
    if (typeof window === "undefined") {
      return;
    }

    nurseAlertTimeoutsRef.current.forEach((timeoutId) =>
      window.clearTimeout(timeoutId)
    );
    nurseAlertTimeoutsRef.current = [];

    setNurseAlertState({
      isVisible: true,
      isOpaque: false,
    });

    const fadeInTimeout = window.setTimeout(() => {
      setNurseAlertState((prev) =>
        prev.isVisible ? { ...prev, isOpaque: true } : prev
      );

      const fadeOutTimeout = window.setTimeout(() => {
        setNurseAlertState((prev) =>
          prev.isVisible ? { ...prev, isOpaque: false } : prev
        );

        const hideTimeout = window.setTimeout(() => {
          setNurseAlertState({ isVisible: false, isOpaque: false });
          nurseAlertTimeoutsRef.current = [];
        }, 500);

        nurseAlertTimeoutsRef.current.push(hideTimeout);
      }, 10000);

      nurseAlertTimeoutsRef.current.push(fadeOutTimeout);
    }, 20);

    nurseAlertTimeoutsRef.current.push(fadeInTimeout);
  };

  useEffect(() => {
    // 입력값 변화에 따라 텍스트 영역 높이를 자동으로 조정합니다.
    if (!textareaRef.current) {
      return;
    }
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [inputValue]);

  useEffect(() => {
    // 한국어 주석: 설정 화면에서 저장한 병원명을 로드합니다.
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        setHospitalName("");
        setSettingSnapshot(null);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown> | null;
      setSettingSnapshot(parsed && typeof parsed === "object" ? parsed : null);
      if (parsed && typeof parsed?.hospitalName === "string") {
        setHospitalName(parsed.hospitalName);
      } else {
        setHospitalName("");
      }
    } catch (error) {
      console.error("병원명 로드 중 오류가 발생했습니다:", error);
      setHospitalName("");
      setSettingSnapshot(null);
    }
  }, []);

  const doneMessages = useMemo(
    () => messages.filter((message) => message.status === "done"),
    [messages]
  );

  const firstDoneUserMessage = useMemo(
    () =>
      doneMessages.find((message) => message.role === "user")?.content ?? "",
    [doneMessages]
  );

  const serialisedDoneMessages = useMemo(() => {
    // 한국어 주석: 요약 생성을 위해 완료된 메시지를 문자열로 직렬화합니다.
    if (doneMessages.length <= 1) {
      return "";
    }
    return doneMessages
      .map((message) => {
        const speaker = message.role === "user" ? "사용자" : "상담사";
        return `${speaker}: ${message.content}`;
      })
      .join("\n");
  }, [doneMessages]);

  useEffect(() => {
    // 한국어 주석: 설정 값과 누적 대화 기록, 현재 세션 메시지를 시스템 프롬프트에 포함합니다.
    if (typeof window === "undefined") {
      return;
    }
    try {
      const contextSections: string[] = [BASE_SYSTEM_PROMPT];

      if (settingSnapshot) {
        contextSections.push(
          `환자 설정 정보:\n${JSON.stringify(settingSnapshot, null, 2)}`
        );
      }

      // const storedHistory = window.localStorage.getItem(
      //   CONVERSATION_STORAGE_KEY
      // );
      // if (storedHistory) {
      //   try {
      //     const parsedHistory = JSON.parse(storedHistory);
      //     if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
      //       contextSections.push(
      //         `과거 대화 히스토리:\n${JSON.stringify(parsedHistory, null, 2)}`
      //       );
      //     }
      //   } catch (error) {
      //     console.error("과거 대화 히스토리를 파싱하지 못했습니다:", error);
      //   }
      // }

      // if (messages.length > 0) {
      //   const currentSessionLog = messages
      //     .map(
      //       (message) =>
      //         `[${message.role}] ${message.content} (status: ${message.status})`
      //     )
      //     .join("\n");
      //   contextSections.push(`현재 세션 기록:\n${currentSessionLog}`);
      // }

      // setPromptValue(contextSections.join("\n\n"));
    } catch (error) {
      console.error("시스템 프롬프트 구성 중 오류가 발생했습니다:", error);
      setPromptValue(BASE_SYSTEM_PROMPT);
    }
  }, [messages, settingSnapshot]);

  useEffect(() => {
    // 한국어 주석: 메시지가 충분하면 GPT에게 요약과 제목 생성을 요청합니다.
    if (typeof window === "undefined") {
      return;
    }
    if (!serialisedDoneMessages) {
      summaryControllerRef.current?.abort();
      summaryControllerRef.current = null;
      setSummaryState((prev) => ({
        status: "idle",
        title: "",
        summary: "",
        error: prev.error,
      }));
      return;
    }

    summaryControllerRef.current?.abort();
    const controller = new AbortController();
    summaryControllerRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      try {
        setSummaryState((prev) => ({
          ...prev,
          status: "loading",
        }));

        const summaryPrompt = [
          // 요약 지시에 CAMS-SSF-4 기반 환자 상태 리포트를 포함하도록 추가함
          {
            role: "system" as ChatRole,
            content:
              "당신은 정신건강 상담 기록을 요약하는 한국인 상담 매니저입니다. 민감한 개인정보는 언급하지 말고, 1문장으로 핵심을 요약하세요. 또한 16자 이내의 한국어 제목을 만들어주세요.",
          },
          {
            role: "user" as ChatRole,
            content: [
              "다음 상담 대화 내용을 요약해서 JSON 포맷으로 돌려주세요.",
              'JSON 스키마: {"title": string, "summary": string}',
              "title은 16자 이내의 한국어로 작성해주세요.",
              "summary는 아래 네 항목을 이 순서대로 작성하고, 각 내용의 앞에는 반드시 '과거 사건:', '인지 사고:', '감정 반응:', '대안 사고:' 형식을 따르세요. 다른 텍스트나 배열 없이 JSON 문자열만 반환하세요.:",
              "과거 사건: 환자가 겪은 사건",
              "인지 사고: 환자의 사고 과정 및 인지 왜곡",
              "감정 반응: 환자가 느낀 감정",
              "대안 사고: 챗봇이 제안한 새로운 인지 사고",
              "또한 아래 CAMS-SSF-4 기반 환자 상태 요약 리포트를 summary에 포함하세요.",
              "환자 상태 요약 리포트 (CAMS-SSF-4 기반)",
              "● 심리적 고통 (Pain): 환자의 심리적 고통",
              "● 절망감 (Hopelessness): 환자의 절망감",
              "● 자기 비하 (Self-Hate): 환자의 자기 비하",
              "● 주요 스트레스원(S): 환자의 주요 스트레스원",
              "주요 호소 내용 (환자 어록)",
              "● 감정(E): 환자가 직접적으로 언급한 환자의 감정",
              "● 생각(T): 환자가 직접적으로 언급한 환자의 생각",
              "",
              serialisedDoneMessages,
            ].join("\n"),
          },
        ];

        const data = await requestChatCompletion({
          model: CHAT_MODEL,
          messages: summaryPrompt,
        });

        if (controller.signal.aborted) {
          return;
        }

        let parsed: { title?: string; summary?: string } = {};
        try {
          parsed =
            typeof data?.message === "string" && data.message.trim().length > 0
              ? (JSON.parse(data.message) as {
                  title?: string;
                  summary?: string;
                })
              : {};
        } catch (error) {
          console.error("요약 응답 JSON 파싱 실패:", error);
        }

        const fallbackTitle =
          firstDoneUserMessage.trim().length > 0
            ? firstDoneUserMessage.slice(0, 16)
            : "제목 미생성";
        const fallbackSummary =
          serialisedDoneMessages.slice(0, 120) || "요약을 확보하지 못했습니다.";

        setSummaryState({
          status: "ready",
          title:
            parsed &&
            typeof parsed.title === "string" &&
            parsed.title.trim().length > 0
              ? parsed.title.trim()
              : fallbackTitle,
          summary:
            parsed &&
            typeof parsed.summary === "string" &&
            parsed.summary.trim().length > 0
              ? parsed.summary.trim()
              : fallbackSummary,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("GPT 요약 생성 중 오류가 발생했습니다:", error);
        setSummaryState({
          status: "error",
          title:
            firstDoneUserMessage.trim().length > 0
              ? firstDoneUserMessage.slice(0, 16)
              : "제목 생성 실패",
          summary: "요약문 생성에 실패했습니다.",
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      } finally {
        if (summaryControllerRef.current === controller) {
          summaryControllerRef.current = null;
        }
      }
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [serialisedDoneMessages, firstDoneUserMessage]);

  useEffect(() => {
    // 한국어 주석: 최신 대화 정보와 요약 결과를 저장용 참조에 보관합니다.
    latestPersistableStateRef.current = {
      messages,
      hospitalName,
      summary: summaryState,
    };
  }, [messages, hospitalName, summaryState]);

  useEffect(() => {
    // 한국어 주석: 라우트를 벗어나기 직전에 대화 기록을 캐시에 저장합니다.
    if (typeof window === "undefined") {
      return;
    }

    const persistConversation = () => {
      try {
        const {
          messages: currentMessages,
          hospitalName: currentHospital,
          summary,
        } = latestPersistableStateRef.current;
        const hasUserMessage = currentMessages.some(
          (message) => message.role === "user" && message.status === "done"
        );
        if (!hasUserMessage) {
          return;
        }
        if (hasPersistedRef.current) {
          return;
        }

        const doneConversationText = currentMessages
          .filter((message) => message.status === "done")
          .map((message) => {
            const speaker = message.role === "user" ? "사용자" : "상담사";
            return `${speaker}: ${message.content}`;
          })
          .join("\n");
        const summaryText =
          summary.summary && summary.summary.trim().length > 0
            ? summary.summary
            : doneConversationText.slice(0, 160) ||
              "요약 정보가 준비되지 않았습니다.";

        const record: StoredConversationRecord = {
          status: "진행중",
          title:
            summary.title && summary.title.trim().length > 0
              ? summary.title
              : currentMessages
                  .find(
                    (message) =>
                      message.role === "user" && message.status === "done"
                  )
                  ?.content.slice(0, 16) ?? "제목 미생성",
          date: new Date().toISOString().split("T")[0],
          hospital:
            currentHospital && currentHospital.trim().length > 0
              ? currentHospital
              : "병원 정보 없음",
          summary: summaryText,
          messages: currentMessages,
          lastUpdatedAt: Date.now(),
        };

        const raw = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
        const parsed = raw
          ? (JSON.parse(raw) as StoredConversationRecord[])
          : [];
        const nextRecords = Array.isArray(parsed) ? parsed : [];
        nextRecords.unshift(record);
        window.localStorage.setItem(
          CONVERSATION_STORAGE_KEY,
          JSON.stringify(nextRecords)
        );
        hasPersistedRef.current = true;
      } catch (error) {
        console.error("대화 기록 저장 중 오류가 발생했습니다:", error);
      }
    };

    window.addEventListener("beforeunload", persistConversation);

    return () => {
      window.removeEventListener("beforeunload", persistConversation);
      persistConversation();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed) {
      return;
    }

    // if (isRealtimeActive && realtimeSessionRef.current) {
    //   // 한국어 주석: 실시간 세션이 열려있는 경우 텍스트 입력도 동일한 세션으로 전달합니다.
    //   realtimeSessionRef.current.sendMessage({
    //     type: "message",
    //     role: "user",
    //     content: [
    //       {
    //         type: "input_text",
    //         text: trimmed,
    //       },
    //     ],
    //   });
    //   setInputValue("");
    //   return;
    // }

    if (isLoading) {
      return;
    }

    // 사용자 입력을 상태에 추가하고 폼을 초기화합니다.
    const userMessage = createChatMessage({
      role: "user",
      content: trimmed,
      status: "done",
    });

    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInputValue("");
    setErrorNotice(null);
    setIsLoading(true);

    const payload: ChatCompletionPayload = {
      model: CHAT_MODEL,
      messages: [
        ...formattedMessagesForApi,
        {
          role: "user",
          content: trimmed,
        },
      ],
    };

    try {
      const data = await requestChatCompletion(payload);
      // 한국어 주석: 모델이 반환한 JSON 문자열에서 message와 score를 안전하게 추출합니다.
      const { message: assistantReply, score: assistantScore } = (() => {
        const fallback = {
          message: "응답이 비어있습니다.",
          score: null as number | null,
        };

        if (typeof data?.message !== "string") {
          return fallback;
        }

        const raw = data.message.trim();
        if (!raw.length) {
          return fallback;
        }

        try {
          const parsed = JSON.parse(raw) as {
            message?: unknown;
            score?: unknown;
          };

          const message =
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.message === "string" &&
            parsed.message.trim().length > 0
              ? parsed.message.trim()
              : raw;

          const score =
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.score === "number"
              ? parsed.score
              : null;

          return { message, score };
        } catch (error) {
          console.warn("응답 JSON 파싱 실패:", error);
          return { message: raw, score: null };
        }
      })();

      setMessages((prev) => {
        if (!prev.length) {
          return prev;
        }

        const next = [...prev];
        const lastIndex = next.length - 1;

        if (next[lastIndex].role === "assistant") {
          next[lastIndex] = {
            ...next[lastIndex],
            status: "done",
            content: assistantReply,
          };
        }

        return next;
      });

      // 한국어 주석: 감정 점수가 높을 때 적절한 안내를 제공합니다.
      if (typeof assistantScore === "number") {
        if (assistantScore > 95) {
          showNurseAlert();
        } else if (assistantScore > 90) {
          startBreathingGuide();
        }
      }
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

      setMessages((prev) => {
        if (!prev.length) {
          return prev;
        }

        const next = [...prev];
        const lastIndex = next.length - 1;

        if (next[lastIndex].role === "assistant") {
          next[lastIndex] = {
            ...next[lastIndex],
            status: "error",
            content: fallbackMessage,
          };
        }

        return next;
      });

      setErrorNotice(fallbackMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  // 음성 히스토리를 채팅 메시지로 변환하는 헬퍼입니다.
  const mapRealtimeMessageToChatMessage = (
    item: RealtimeMessageItem
  ): ChatMessage | null => {
    if (item.role === "system") {
      return null;
    }

    if (item.role === "user") {
      const aggregated = item.content
        .map((block) => {
          if (block.type === "input_text") {
            return block.text;
          }
          if (block.type === "input_audio") {
            return block.transcript ?? "";
          }
          return "";
        })
        .join(" ")
        .trim();

      const previous = voiceMessageCacheRef.current.get(item.itemId);
      const statusFromRealtime: ChatMessage["status"] =
        item.status === "completed"
          ? "done"
          : item.status === "in_progress"
          ? "pending"
          : "error";
      const content =
        aggregated.length > 0
          ? aggregated
          : previous?.content ?? "음성을 전사하는 중입니다...";
      const status =
        statusFromRealtime === "pending" && previous?.status
          ? previous.status
          : statusFromRealtime;

      const message: ChatMessage = {
        id: item.itemId,
        role: "user",
        content,
        status,
        createdAt: previous?.createdAt ?? Date.now(),
      };

      voiceMessageCacheRef.current.set(item.itemId, message);
      return message;
    }

    if (item.role === "assistant") {
      const aggregated = item.content
        .map((block) => {
          if (block.type === "output_text") {
            return block.text;
          }
          if (block.type === "output_audio") {
            return block.transcript ?? "";
          }
          return "";
        })
        .join("")
        .trim();

      const previous = voiceMessageCacheRef.current.get(item.itemId);
      const statusFromRealtime: ChatMessage["status"] =
        item.status === "completed"
          ? "done"
          : item.status === "in_progress"
          ? "pending"
          : "error";
      const content =
        aggregated.length > 0
          ? aggregated
          : previous?.content ?? "응답을 준비하는 중입니다...";
      const status =
        statusFromRealtime === "pending" && previous?.status
          ? previous.status
          : statusFromRealtime;

      const message: ChatMessage = {
        id: item.itemId,
        role: "assistant",
        content,
        status,
        createdAt: previous?.createdAt ?? Date.now(),
      };

      voiceMessageCacheRef.current.set(item.itemId, message);
      return message;
    }

    return null;
  };

  const syncVoiceHistory = (history: RealtimeItem[]) => {
    // 한국어 주석: Realtime 세션 히스토리를 일반 채팅 메시지 목록과 동기화합니다.
    const nextVoiceMessages: ChatMessage[] = [];

    history.forEach((item) => {
      if (item.type !== "message") {
        return;
      }
      const mapped = mapRealtimeMessageToChatMessage(item);
      if (mapped) {
        nextVoiceMessages.push(mapped);
      }
    });

    voiceMessageIdsRef.current = new Set(
      nextVoiceMessages.map((message) => message.id)
    );
    voiceHistoryLogRef.current = nextVoiceMessages
      .map((message) => {
        const cached = voiceMessageCacheRef.current.get(message.id);
        return cached ?? message;
      })
      .sort((a, b) => a.createdAt - b.createdAt); // 한국어 주석: 종료 시 콘솔로 출력할 수 있도록 시간 순으로 정렬해 저장합니다.
  };

  const teardownRealtimeSession = () => {
    // 한국어 주석: 음성 세션을 종료하고 자원을 정리합니다.
    const session = realtimeSessionRef.current;
    if (session) {
      try {
        session.close();
      } catch (error) {
        console.error("Realtime 세션 종료 중 오류:", error);
      }
      realtimeSessionRef.current = null;
    }

    if (realtimeTransportRef.current) {
      try {
        realtimeTransportRef.current.close();
      } catch (error) {
        console.error("WebRTC 전송 종료 중 오류:", error);
      }
      realtimeTransportRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.src = "";
    }

    voiceMessageIdsRef.current = new Set();
    voiceMessageCacheRef.current = new Map();
    voiceHistoryLogRef.current = []; // 한국어 주석: 새로운 세션을 위해 음성 히스토리 로그를 초기화합니다.
    setIsRealtimeActive(false);
    setIsRealtimeConnecting(false);
  };

  // 컴포넌트 언마운트 시 음성 세션을 정리합니다.
  useEffect(() => {
    return () => {
      teardownRealtimeSession();
    };
  }, []);

  const startRealtimeSession = async () => {
    // 한국어 주석: OpenAI Realtime API 세션을 생성하고 연결합니다.
    if (isRealtimeActive || isRealtimeConnecting) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setErrorNotice(
        "현재 브라우저에서는 실시간 음성 대화를 사용할 수 없습니다."
      );
      return;
    }

    setErrorNotice(null);
    setIsRealtimeConnecting(true);

    try {
      const response = await fetch("/api/realtime/session", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const fallbackError =
          errorData && typeof errorData.error === "string"
            ? errorData.error
            : "음성 세션 토큰을 발급받지 못했습니다.";
        throw new Error(fallbackError);
      }

      const sessionPayload = await response.json();
      const clientSecret: string | undefined =
        sessionPayload?.client_secret?.value ??
        sessionPayload?.client_secret ??
        sessionPayload?.clientSecret;

      if (!clientSecret) {
        throw new Error("실시간 세션 인증 토큰이 비어있습니다.");
      }

      const audioElement =
        remoteAudioRef.current ??
        (() => {
          const element = new Audio();
          element.autoplay = true;
          element.setAttribute("playsinline", "true");
          remoteAudioRef.current = element;
          return element;
        })();

      const transport = new OpenAIRealtimeWebRTC({
        audioElement,
        baseUrl: `${REALTIME_BASE_URL}?model=${encodeURIComponent(
          REALTIME_MODEL
        )}`,
      });

      // 한국어 주석: SDK가 session.update 이벤트에 포함하는 type 필드는 최신 Realtime API에서 허용되지 않아 제거합니다.
      const originalSendEvent = transport.sendEvent.bind(transport);
      transport.sendEvent = (event) => {
        if (event?.type === "session.update" && event.session) {
          const nextEvent = {
            ...event,
            session: { ...event.session },
          };
          delete nextEvent.session.type;
          if ("output_modalities" in nextEvent.session) {
            nextEvent.session.modalities = nextEvent.session.output_modalities;
            delete nextEvent.session.output_modalities;
          }
          if (Array.isArray(nextEvent.session.modalities)) {
            const hasAudio = nextEvent.session.modalities.includes("audio");
            const hasText = nextEvent.session.modalities.includes("text");
            if (hasAudio && !hasText) {
              nextEvent.session.modalities = [
                ...nextEvent.session.modalities,
                "text",
              ];
            }
            if (!hasAudio && !hasText) {
              nextEvent.session.modalities = ["audio", "text"];
            }
          } else if (!nextEvent.session.modalities) {
            nextEvent.session.modalities = ["audio", "text"];
          }
          if ("audio" in nextEvent.session && nextEvent.session.audio) {
            const audioConfig = nextEvent.session.audio as {
              input?: {
                transcription?: Record<string, unknown>;
                format?:
                  | string
                  | {
                      type?: string;
                      rate?: number;
                    };
              };
              output?: {
                voice?: string;
                format?:
                  | string
                  | {
                      type?: string;
                      rate?: number;
                    };
              };
            };
            if (
              audioConfig.input &&
              typeof audioConfig.input.transcription === "object"
            ) {
              nextEvent.session.input_audio_transcription =
                audioConfig.input.transcription;
            }
            if (
              audioConfig.input &&
              typeof audioConfig.input.format === "string"
            ) {
              nextEvent.session.input_audio_format = audioConfig.input.format;
            }
            if (
              audioConfig.output &&
              typeof audioConfig.output.voice === "string"
            ) {
              nextEvent.session.voice = audioConfig.output.voice;
            }
            if (
              audioConfig.output &&
              typeof audioConfig.output.format === "string"
            ) {
              nextEvent.session.output_audio_format = audioConfig.output.format;
            }
            delete nextEvent.session.audio;
          }
          originalSendEvent(nextEvent);
          return;
        }
        originalSendEvent(event);
      };

      const agent = new RealtimeAgent({
        name: "voice-counselor",
        instructions: promptValueVoice.trim(),
        voice: REALTIME_VOICE,
      });

      const session = new RealtimeSession(agent, {
        transport,
        model: REALTIME_MODEL,
        config: {
          modalities: ["audio", "text"],
          audio: {
            input: {
              transcription: {
                model: REALTIME_TRANSCRIBE_MODEL,
              },
            },
            output: {
              voice: REALTIME_VOICE,
            },
          },
        },
      });

      session.on("history_updated", syncVoiceHistory);
      session.on("agent_end", (_context, _agent, output) => {
        // 한국어 주석: 음성 응답이 완료되면 최신 어시스턴트 메시지 내용을 덮어씁니다.
        const trimmed = typeof output === "string" ? output.trim() : "";
        if (!trimmed) {
          return;
        }

        const latestAssistant = [...voiceHistoryLogRef.current]
          .slice()
          .reverse()
          .find((message) => message.role === "assistant");

        if (!latestAssistant) {
          return;
        }

        const updatedMessage: ChatMessage = {
          ...latestAssistant,
          content: trimmed,
          status: "done",
        };

        voiceMessageCacheRef.current.set(updatedMessage.id, updatedMessage);
        voiceHistoryLogRef.current = voiceHistoryLogRef.current.map((message) =>
          message.id === updatedMessage.id ? updatedMessage : message
        );
      });
      session.on("error", (event) => {
        const errorMessage =
          (event?.error as { error?: { message?: string } })?.error?.message ??
          (event?.error as { message?: string })?.message ??
          "실시간 음성 세션에서 오류가 감지되었습니다.";
        setErrorNotice(errorMessage);
      });

      realtimeTransportRef.current = transport;
      realtimeSessionRef.current = session;

      await session.connect({
        apiKey: () => clientSecret,
        model: REALTIME_MODEL,
      });

      setIsRealtimeActive(true);
    } catch (error) {
      let fallback =
        error instanceof Error
          ? error.message
          : "실시간 음성 세션 연결에 실패했습니다.";
      if (
        typeof fallback === "string" &&
        fallback.toLowerCase().includes("expect line: v=")
      ) {
        // 한국어 주석: SDP 파싱 오류는 주로 모델 권한 또는 세션 토큰 포맷 문제에서 발생합니다.
        fallback =
          "실시간 세션 초기화 중 오류가 발생했습니다. 모델 접근 권한과 환경 변수를 다시 확인한 뒤 새로고침 해주세요.";
      }
      setErrorNotice(fallback);
      teardownRealtimeSession();
    } finally {
      setIsRealtimeConnecting(false);
    }
  };

  const logRealtimeConversationHistory = () => {
    // 한국어 주석: 마이크 종료 시 음성 세션 히스토리를 콘솔로 남깁니다.
    const voiceHistory = voiceHistoryLogRef.current;
    if (!voiceHistory.length) {
      console.info(
        "[Realtime Voice] 기록된 음성 대화가 없어 출력만 건너뜁니다."
      );
      return;
    }
    console.log(
      "[Realtime Voice] 세션 대화 히스토리",
      voiceHistory.map(({ id, role, content, status, createdAt }) => ({
        id,
        role,
        content,
        status,
        createdAt,
      }))
    );
  };

  const handleToggleMicrophone = async () => {
    // 한국어 주석: 마이크 토글에 따라 실시간 음성 세션을 시작하거나 종료합니다.
    if (isRealtimeActive) {
      logRealtimeConversationHistory();
      teardownRealtimeSession();
      return;
    }
    await startRealtimeSession();
  };

  // 한국어 주석: 현재 심호흡 안내 단계에 따라 표시할 정보를 계산합니다.
  const currentBreathingStep = breathingGuideState.isVisible
    ? BREATHING_SEQUENCE[breathingGuideState.stepIndex] ?? null
    : null;
  const breathingCycleDisplay = breathingGuideState.isVisible
    ? Math.min(breathingGuideState.cycle + 1, 3)
    : 0;
  const breathingCircleVariant = currentBreathingStep?.circle ?? "idle";
  const breathingCircleScaleClass =
    breathingCircleVariant === "inhale" || breathingCircleVariant === "hold"
      ? "scale-100"
      : breathingCircleVariant === "exhale"
      ? "scale-70"
      : "scale-80";
  const breathingCircleColorClass =
    breathingCircleVariant === "exhale"
      ? "bg-amber-100/70"
      : breathingCircleVariant === "hold"
      ? "bg-amber-100/80"
      : "bg-amber-100/70";
  const breathingCircleLabel =
    breathingCircleVariant === "inhale"
      ? "들이마셔요"
      : breathingCircleVariant === "hold"
      ? "숨을 참아봐요"
      : breathingCircleVariant === "exhale"
      ? "내쉬어요"
      : "준비해요";
  // 한국어 주석: 마이크가 실시간 음성 모드로 준비된 경우에만 배경을 노출합니다.
  const shouldShowRealtimeBackdrop = isRealtimeActive && !isRealtimeConnecting;

  return (
    <>
      <div className="flex flex-1">
        <div className="relative z-0 p-2 md:p-10 rounded-tl-2xl border border-neutral-200 bg-white flex flex-col gap-6 flex-1 w-full h-full">
          {nurseAlertState.isVisible && (
            <div
              className={`pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-red-600/90 backdrop-blur-md transition-opacity duration-500 ${
                nurseAlertState.isOpaque ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex flex-col items-center gap-4 text-center text-white">
                <p className="text-4xl font-extrabold md:text-5xl">
                  간호사를 호출하시겠습니까?
                </p>
                <p className="text-3xl font-bold">예 / 아니오</p>
              </div>
            </div>
          )}
          {breathingGuideState.isVisible && (
            <div
              className={`pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-brand-gradient backdrop-blur-sm transition-opacity duration-500 ${
                breathingGuideState.isOpaque ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-lg font-semibold text-white md:text-xl">
                  {currentBreathingStep?.text}
                </p>
                <div
                  className={`flex h-40 w-40 items-center justify-center rounded-full shadow-lg transition-transform ease-in-out ${breathingCircleScaleClass} ${breathingCircleColorClass}`}
                  style={{
                    transitionDuration: `${
                      currentBreathingStep?.duration ?? 2000
                    }ms`,
                  }}
                >
                  <span className="text-sm font-semibold text-amber-900 md:text-base">
                    {breathingCircleLabel}
                  </span>
                </div>
                {breathingCycleDisplay > 0 && (
                  <p className="text-sm font-medium text-white/90">
                    {breathingCycleDisplay} / 3
                  </p>
                )}
              </div>
            </div>
          )}
          {shouldShowRealtimeBackdrop ? (
            <ShaderBackground />
          ) : (
            <>
              <h1 className="text-2xl font-bold">새 대화</h1>

              <main
                ref={messageContainerRef}
                className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8"
              >
                {messages.length === 0 ? (
                  <section className="flex h-full flex-col items-center justify-center gap-6 text-center text-neutral-500">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-600">
                      <Sparkles className="h-10 w-10" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold text-neutral-800 md:text-xl">
                        새로운 상담을 시작해보세요
                      </h2>
                    </div>
                  </section>
                ) : (
                  <div className="flex flex-col gap-6">
                    {messages.map((message) => (
                      <article
                        key={message.id}
                        className={`flex w-full ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                            message.role === "user"
                              ? "bg-brand-gradient text-white"
                              : "bg-white text-neutral-800 shadow-sm ring-1 ring-black/5"
                          }`}
                        >
                          {message.role === "user" ? (
                            <p className="whitespace-pre-wrap leading-7">
                              {message.content}
                            </p>
                          ) : message.status === "done" ? (
                            <TextGenerateEffect
                              duration={1}
                              filter={false}
                              words={message.content}
                              className="whitespace-pre-wrap leading-7"
                            />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {/* {message.status === "pending" && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )} */}
                          {message.status === "error" && (
                            <div className="mt-3 text-xs text-rose-500">
                              응답을 불러오지 못했어요. 입력을 확인하고 다시
                              시도해주세요.
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </main>

              <footer className="border-t border-neutral-200 bg-white px-4 py-4 md:px-8 md:py-6">
                {errorNotice && (
                  <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                    {errorNotice}
                  </div>
                )}
                <form
                  onSubmit={handleSubmit}
                  ref={formRef}
                  className="group relative flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 shadow-sm transition focus-within:border-transparent focus-within:[background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box] focus-within:rounded-2xl focus-within:shadow-md md:flex-row md:items-center md:p-4"
                >
                  <label className="sr-only" htmlFor="chat-input">
                    상담 메시지 입력
                  </label>
                  <textarea
                    id="chat-input"
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(event) => {
                      setInputValue(event.target.value);
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="당신의 이야기를 듣고 싶어요."
                    rows={1}
                    spellCheck={false}
                    disabled={isRealtimeActive || isRealtimeConnecting}
                    className={`w-full resize-none bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400 md:text-base ${
                      isRealtimeActive || isRealtimeConnecting
                        ? "hover:cursor-not-allowed"
                        : ""
                    }`}
                    style={{ minHeight: "48px", maxHeight: "200px" }}
                  />
                  <div className="flex flex-row items-center justify-between gap-2 md:items-end">
                    <button
                      type="button"
                      onClick={handleToggleMicrophone}
                      disabled={isRealtimeConnecting}
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${
                        isRealtimeActive
                          ? "border-transparent bg-white text-brand-500 [background:linear-gradient(#ffffff,#ffffff)_padding-box,var(--brand-gradient)_border-box]"
                          : "border-neutral-200 bg-white text-neutral-500"
                      } transition hover:border-transparent hover:[background:linear-gradient(#ffffff,#ffffff)_padding-box,var(--brand-gradient)_border-box] hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {isRealtimeConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mic
                          className={`h-4 w-4 ${
                            isRealtimeActive ? "animate-pulse" : ""
                          }`}
                        />
                      )}
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !inputValue.trim()}
                      className="inline-flex h-12 w-12 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white transition hover:bg-brand-gradient disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </footer>
            </>
          )}
        </div>
      </div>
    </>
  );
}

async function requestChatCompletion(payload: ChatCompletionPayload) {
  // OpenAPI 서버 프록시 라우트에 POST 요청을 수행합니다.
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    throw new Error(
      errorMessage || "OpenAI 요청 중 문제가 발생했습니다. 다시 시도해주세요."
    );
  }

  return response.json();
}

async function readErrorMessage(response: Response) {
  // 서버에서 반환한 오류 메시지를 문자열로 정제합니다.
  try {
    const data = await response.json();
    if (data && typeof data === "object" && "error" in data) {
      const typed = data as Record<string, unknown>;
      if (typeof typed.error === "string") {
        return typed.error;
      }
      if (
        typed.error &&
        typeof typed.error === "object" &&
        "message" in (typed.error as Record<string, unknown>) &&
        typeof (typed.error as Record<string, unknown>).message === "string"
      ) {
        return (typed.error as Record<string, unknown>).message as string;
      }
    }
    if (data && typeof data === "string") {
      return data;
    }
  } catch {
    // JSON 파싱에 실패한 경우에는 텍스트를 그대로 반환합니다.
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}
