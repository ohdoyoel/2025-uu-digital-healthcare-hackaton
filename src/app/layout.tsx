import localFont from "next/font/local";
import type { Metadata } from "next";
import "./globals.css";

const pretendard = localFont({
  src: "../fonts/pretendard/PretendardVariable.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "ER:ight?",
  description:
    "ER:ight? is a platform for healthcare professionals to improve patient care.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.className}>
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
