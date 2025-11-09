import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Responses API 기본 모델을 지정합니다.
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_OPENAI_MODEL ?? "gpt-5";

export async function POST(request: NextRequest) {
  // OpenAI API 키가 설정되지 않은 경우 사용자에게 안내합니다.
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OpenAI API 키가 설정되어 있지 않습니다. 환경 변수 OPENAI_API_KEY를 확인해주세요.",
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "요청 본문을 파싱하지 못했습니다. JSON 형식으로 메시지를 전달해주세요.",
      },
      { status: 400 }
    );
  }

  const { messages, model } = (body ?? {}) as {
    messages?: Array<{ role: string; content: string }>;
    model?: string;
  };

  // 메시지가 배열 형식인지 검증합니다.
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      {
        error: "대화 메시지 배열이 필요합니다.",
      },
      { status: 400 }
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    // Responses API가 요구하는 입력 포맷으로 변환합니다.
    const input = messages.map((message) => ({
      role: normalizeRole(message.role),
      content: [
        {
          type:
            message.role === "assistant"
              ? ("output_text" as const)
              : ("input_text" as const),
          text: message.content,
        },
      ],
    })) as OpenAI.Responses.ResponseInput;

    const response = await openai.responses.create({
      model:
        typeof model === "string" && model.length > 0 ? model : DEFAULT_MODEL,
      input,
    });

    const messageText = extractOutputText(response);

    return NextResponse.json({
      message: messageText,
    });
  } catch (error) {
    console.error("OpenAI Responses 호출 실패:", error);
    const fallbackMessage =
      error instanceof Error
        ? error.message
        : "OpenAPI 요청 중 예기치 못한 오류가 발생했습니다.";
    return NextResponse.json(
      {
        error: fallbackMessage,
      },
      { status: 500 }
    );
  }
}

function normalizeRole(
  role: string
): "user" | "assistant" | "system" | "developer" {
  // Responses API가 허용하는 역할 값으로 정규화합니다.
  if (role === "assistant" || role === "system" || role === "developer") {
    return role;
  }
  return "user";
}

function extractOutputText(response: OpenAI.Responses.Response): string {
  // output_text 필드가 존재하면 가장 먼저 사용합니다.
  if (
    typeof response.output_text === "string" &&
    response.output_text.trim().length > 0
  ) {
    return response.output_text;
  }

  // output 배열을 순회하며 텍스트 콘텐츠를 추출합니다.
  if (Array.isArray(response.output)) {
    const textSegments = response.output.flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) {
        return [];
      }

      const content = (item as { content?: Array<unknown> }).content;
      if (!Array.isArray(content)) {
        return [];
      }

      return content
        .filter(
          (block): block is { type: string; text?: string } =>
            !!block && typeof block === "object" && "type" in block
        )
        .filter(
          (block) => block.type === "output_text" || block.type === "text"
        )
        .map((block) => block.text ?? "")
        .filter((text): text is string => typeof text === "string");
    });

    const merged = textSegments.join("").trim();
    if (merged.length > 0) {
      return merged;
    }
  }

  // 모든 시도가 실패하면 응답 전체를 문자열화합니다.
  try {
    return JSON.stringify(response);
  } catch {
    return "응답을 파싱하는 과정에서 오류가 발생했습니다.";
  }
}
