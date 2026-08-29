import type { ReactNode } from 'react';

export const metadata = {
  title: 'LibreDB Studio — content',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // id="outstatic" is REQUIRED, not decoration: every utility class in
  // outstatic.css is nested inside `#outstatic { ... }`. Drop it and the whole
  // dashboard renders unstyled.
  return (
    <html lang="en" suppressHydrationWarning>
      <body id="outstatic">{children}</body>
    </html>
  );
}
