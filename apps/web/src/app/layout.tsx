import type { Metadata } from "next";
import { ToastProvider } from "@/components/toast-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tchuno",
    template: "%s | Tchuno",
  },
  description:
    "Marketplace moçambicano para pedir serviços locais, receber propostas e acompanhar o serviço com mais clareza.",
  applicationName: "Tchuno",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
