// src/components/ThemeProvider.tsx
import { useEffect } from 'react';

// Hàm chuyển đổi hex sang HSL
const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  hex = hex.replace('#', '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

// Áp dụng màu sắc vào CSS variables
const applyThemeColors = (buttonColor: string, menuColor: string) => {
  const root = document.documentElement;
  
  const buttonHSL = hexToHSL(buttonColor);
  const menuHSL = hexToHSL(menuColor);
  
  // PRIMARY COLOR
  root.style.setProperty('--primary', `${buttonHSL.h} ${buttonHSL.s}% ${buttonHSL.l}%`);
  
  // PRIMARY FOREGROUND - Luôn đảm bảo contrast cao (trắng cho background tối, đen cho background sáng)
  const primaryForeground = buttonHSL.l > 55 ? '0 0% 10%' : '0 0% 100%';
  root.style.setProperty('--primary-foreground', primaryForeground);
  
  // SECONDARY COLOR
  root.style.setProperty('--secondary', `${menuHSL.h} ${menuHSL.s}% ${menuHSL.l}%`);
  
  const secondaryForeground = menuHSL.l > 55 ? '222.2 47.4% 11.2%' : '0 0% 100%';
  root.style.setProperty('--secondary-foreground', secondaryForeground);
  
  // ACCENT COLOR
  const accentL = Math.min(buttonHSL.l + 45, 95);
  root.style.setProperty('--accent', `${buttonHSL.h} ${Math.max(buttonHSL.s - 20, 30)}% ${accentL}%`);
  root.style.setProperty('--accent-foreground', `${buttonHSL.h} ${buttonHSL.s}% ${buttonHSL.l}%`);
  
  // MUTED COLOR
  root.style.setProperty('--muted', `${menuHSL.h} ${Math.max(menuHSL.s - 10, 0)}% ${Math.min(menuHSL.l + 2, 98)}%`);
  const mutedForeground = menuHSL.l > 70 ? '215.4 16.3% 46.9%' : '0 0% 60%';
  root.style.setProperty('--muted-foreground', mutedForeground);
  
  // RING COLOR
  root.style.setProperty('--ring', `${buttonHSL.h} ${buttonHSL.s}% ${buttonHSL.l}%`);
  
  // BORDER COLOR
  const borderL = Math.min(menuHSL.l + 10, 95);
  root.style.setProperty('--border', `${menuHSL.h} ${Math.max(menuHSL.s - 20, 15)}% ${borderL}%`);
  
  // SIDEBAR COLORS - Luôn dùng màu trắng cho text trên sidebar
  root.style.setProperty('--sidebar-bg', buttonColor);
  root.style.setProperty('--sidebar-text', '#FFFFFF'); // Force white text
  root.style.setProperty('--sidebar-active', `${buttonHSL.h} ${Math.min(buttonHSL.s + 10, 100)}% ${Math.min(buttonHSL.l + 10, 90)}%`);
  root.style.setProperty('--sidebar-hover', `${buttonHSL.h} ${buttonHSL.s}% ${Math.min(buttonHSL.l + 5, 85)}%`);
  
  // CARD COLORS
  root.style.setProperty('--card-highlight', menuColor);
  root.style.setProperty('--card-border', `hsl(${menuHSL.h} ${Math.max(menuHSL.s - 15, 0)}% ${Math.max(menuHSL.l - 10, 80)}%)`);
};

// Load màu từ localStorage
const loadSavedColors = () => {
  const buttonColor = localStorage.getItem('theme-button-color') || '#222831';
  const menuColor = localStorage.getItem('theme-menu-color') || '#e8f4fa';
  return { buttonColor, menuColor };
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    // Load và apply màu đã lưu khi app khởi động
    const { buttonColor, menuColor } = loadSavedColors();
    applyThemeColors(buttonColor, menuColor);
    
    // Log để debug (có thể xóa sau)
    console.log('🎨 Theme colors loaded:', { buttonColor, menuColor });
  }, []);

  return <>{children}</>;
}

// Export các hàm utility để sử dụng ở component khác
export { applyThemeColors, hexToHSL, loadSavedColors };