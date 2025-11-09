import { NextResponse } from "next/server";
import OpenAI from "openai";

// 실시간 음성 세션 구성 기본값을 정의합니다.
const REALTIME_MODEL =
  process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ??
  "gpt-4o-mini-realtime-preview";
const REALTIME_VOICE = process.env.NEXT_PUBLIC_OPENAI_VOICE ?? "alloy";
const REALTIME_TRANSCRIBE_MODEL =
  process.env.NEXT_PUBLIC_OPENAI_STT_MODEL ?? "gpt-4o-mini-transcribe";

export async function POST() {
  // 한국어 주석: 클라이언트 토큰 발급을 위해 백엔드에서만 API 키를 사용합니다.
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OpenAI API 키가 설정되어 있지 않습니다. 환경 변수를 확인해주세요.",
      },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey });

  try {
    const session = await client.beta.realtime.sessions.create({
      model: REALTIME_MODEL as any,
      voice: REALTIME_VOICE,
      modalities: ["audio", "text"],
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: REALTIME_TRANSCRIBE_MODEL,
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Realtime 세션 생성 실패:", error);
    const fallbackMessage =
      error instanceof Error
        ? error.message
        : "실시간 세션 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      {
        error: fallbackMessage,
      },
      { status: 500 }
    );
  }
}
