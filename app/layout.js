export const metadata = {
  title: "keibach — 競馬データ分析",
  description: "JRA 10年33,283レースの自前DBで回収率を検証する分析ツール",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
