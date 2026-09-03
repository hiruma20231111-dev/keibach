export const metadata = {
  title: "keibach — レース別 期待値ナビ",
  description: "検討レースの条件とモードを選ぶと、買い方と正直な期待値をJRA10年33,283レースの実測から提示",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
