import "./globals.css";

export const metadata = {
  title: "مخطط الحضور والمواصلات",
  description: "نظام إدارة الحضور الأسبوعي وحساب احتياج المواصلات",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
