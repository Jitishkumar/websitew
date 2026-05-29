export const theme = {
  dark: {
    backgrounds: ['#0f0f23', '#1a1a2e', '#16213e'], // Deep navy-black gradient
    backgroundSolid: '#0f0f23',
    surface: '#161630',
    surfaceElevated: '#1a1a3a',
    primaryAccent: '#5F73F2', // Calm, elegant indigo/blue
    secondaryAccent: '#38BDF8',
    textPrimary: '#E2E8F0', // Soft off-white
    textSecondary: '#94A3B8', // Muted slate-blue
    border: 'rgba(95, 115, 242, 0.15)',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  },
  light: {
    backgrounds: ['#F1F5F9', '#F8FAFC', '#F1F5F9'], // Calm light gray-blue gradient
    backgroundSolid: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceElevated: '#F8FAFC',
    primaryAccent: '#4F46E5', // Deeper premium indigo
    secondaryAccent: '#0284C7',
    textPrimary: '#0F172A', // Dark charcoal/navy
    textSecondary: '#475569',
    border: 'rgba(79, 70, 229, 0.08)',
    success: '#059669',
    error: '#DC2626',
    warning: '#D97706',
  }
};

export const getTheme = (isDarkMode) => (isDarkMode ? theme.dark : theme.light);
