import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TestBridge } from "@/components/TestBridge";
import { AuthProvider } from "@/lib/hooks/useAuth";
import "./globals.css";

export const metadata: Metadata = {
  title: "好学伴 — 学习计划与打卡统计助手",
  description: "帮助家长规划孩子学习任务、追踪完成情况、分析成绩变化，通过游戏化激励提升孩子学习自驱力。",
};

/** 阻塞式脚本：在 React hydrate 之前设置背景色，防止白闪 */
const themeInitScript = `
(function(){
  var t=localStorage.getItem('study-planner-theme');
  var themes={
    dojo:{bg:'#FAFAF5',text:'#1C1917'},
    magic:{bg:'#FFF8F0',text:'#1A1A2E'},
    garden:{bg:'#F7FBF4',text:'#1A2E1A'},
    ocean:{bg:'#F0F9FF',text:'#0C1B2E'}
  };
  var c=themes[t]||themes.dojo;
  var s=document.documentElement.style;
  s.setProperty('--bg-primary',c.bg);
  s.setProperty('--text-primary',c.text);
  s.backgroundColor=c.bg;
  s.color=c.text;
})();
`;

/**
 * 按需加载 Google Fonts CSS。
 * 已加载过的 font family 不会重复注入 <link>。
 */
const lazyFontsScript = `
(function(){
  var loaded=new Set();
  window.__loadThemeFont=function(families){
    families.forEach(function(f){
      if(loaded.has(f))return;
      loaded.add(f);
      var link=document.createElement('link');
      link.rel='stylesheet';
      link.href='https://fonts.googleapis.com/css2?family='+f+'&display=swap';
      document.head.appendChild(link);
    });
  };
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 仅预加载默认 dojo 主题的 display 字体 */}
        <link
          href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap"
          rel="stylesheet"
        />
        <Script id="theme-init" strategy="beforeInteractive">{themeInitScript}</Script>
        <Script id="lazy-fonts" strategy="beforeInteractive">{lazyFontsScript}</Script>
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <TestBridge />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
