"use client";

import { FormEvent, useEffect, useState } from "react";

type SettingFormData = {
  name: string;
  gender: string;
  birthDate: string;
  ktasCode: string;
  notes: string;
  hospitalName: string;
};

const STORAGE_KEY = "settingFormData";

const initialState: SettingFormData = {
  name: "",
  gender: "",
  birthDate: "",
  ktasCode: "",
  notes: "",
  hospitalName: "",
};

export default function SettingPage() {
  const [formData, setFormData] = useState<SettingFormData>(initialState);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    // 저장된 데이터를 초기화 시점에 불러오기 위한 로직
    if (typeof window === "undefined") {
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<SettingFormData>;
        // 신규 필드를 초기 상태와 병합하여 누락된 값이 없도록 합니다
        setFormData({
          ...initialState,
          ...parsed,
        });
        setStatusMessage("이전에 저장된 정보를 불러왔습니다.");
      } catch (error) {
        console.error("Failed to parse saved data", error);
        setStatusMessage("저장된 정보를 불러오지 못했습니다.");
      }
    }
  }, []);

  const handleChange =
    (key: keyof SettingFormData) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // 입력 필드 변경을 상태에 반영하기 위한 로직
      const { value } = event.target;
      setFormData((prev) => ({
        ...prev,
        [key]: value,
      }));
    };

  const handleGenderToggle = (value: "남" | "여") => {
    // 성별을 토글 버튼으로 선택하도록 구현했습니다
    setFormData((prev) => ({
      ...prev,
      gender: prev.gender === value ? "" : value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 브라우저 캐시에 저장하기 위한 로직
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      setStatusMessage("저장되었습니다.");
    }
  };

  return (
    <div className="flex flex-1">
      <div className="p-2 md:p-10 rounded-tl-2xl border border-neutral-200 bg-white flex flex-col gap-6 flex-1 w-full h-full">
        <h1 className="text-2xl font-bold">설정</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-row gap-6">
            <div className="flex flex-col gap-2 w-full">
              <label
                htmlFor="name"
                className="text-sm font-medium text-gray-700"
              >
                이름
              </label>
              <input
                id="name"
                type="text"
                className="rounded border border-gray-300 px-3 py-2 focus:border-transparent focus:[background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box] focus:outline-none focus:ring-2 focus:ring-transparent [background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box]"
                value={formData.name}
                onChange={handleChange("name")}
                placeholder="홍길동"
              />
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label
                htmlFor="birthDate"
                className="text-sm font-medium text-gray-700"
              >
                생년월일
              </label>
              <input
                id="birthDate"
                type="date"
                className="rounded border border-gray-300 px-3 py-2 focus:border-transparent focus:[background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box] focus:outline-none focus:ring-2 focus:ring-transparent [background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box]"
                value={formData.birthDate}
                onChange={handleChange("birthDate")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="gender"
                className="text-sm font-medium text-gray-700"
              >
                성별
              </label>
              <div className="flex gap-2">
                <button
                  id="gender"
                  type="button"
                  onClick={() => handleGenderToggle("남")}
                  className={`rounded px-4 py-2 transition ${
                    formData.gender === "남"
                      ? "bg-brand-gradient text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-pressed={formData.gender === "남"}
                >
                  남
                </button>
                <button
                  type="button"
                  onClick={() => handleGenderToggle("여")}
                  className={`rounded px-4 py-2 transition ${
                    formData.gender === "여"
                      ? "bg-brand-gradient text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-pressed={formData.gender === "여"}
                >
                  여
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {/* 병원 정보를 입력받기 위한 필드입니다 */}
            <label
              htmlFor="hospitalName"
              className="text-sm font-medium text-gray-700"
            >
              병원명
            </label>
            <input
              id="hospitalName"
              type="text"
              className="rounded border border-gray-300 px-3 py-2 focus:border-transparent focus:[background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box] focus:outline-none focus:ring-2 focus:ring-transparent [background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box]"
              value={formData.hospitalName}
              onChange={handleChange("hospitalName")}
              placeholder="예: 서울중앙병원"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="ktasCode"
              className="text-sm font-medium text-gray-700"
            >
              KTAS 증상
            </label>
            <input
              id="ktasCode"
              type="text"
              className="rounded border border-gray-300 px-3 py-2 focus:border-transparent focus:[background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box] focus:outline-none focus:ring-2 focus:ring-transparent [background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box]"
              value={formData.ktasCode}
              onChange={handleChange("ktasCode")}
              placeholder="예: A010"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700"
            >
              기타 소견
            </label>
            <textarea
              id="notes"
              className="min-h-[120px] rounded border border-gray-300 px-3 py-2 focus:border-transparent focus:[background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box] focus:outline-none focus:ring-2 focus:ring-transparent [background:linear-gradient(#fafafa,#fafafa)_padding-box,var(--brand-gradient)_border-box] resize-none"
              value={formData.notes}
              onChange={handleChange("notes")}
              placeholder="추가 소견을 입력해주세요."
            />
          </div>
          <button
            type="submit"
            className="rounded bg-brand-gradient px-4 py-2 text-white transition hover:bg-brand-gradient"
          >
            저장
          </button>
        </form>
        {statusMessage && (
          <p className="text-sm text-gray-600">{statusMessage}</p>
        )}
      </div>
    </div>
  );
}
