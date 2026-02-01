import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: 'primary' | 'secondary' | 'danger';
 size?: 'sm' | 'md' | 'lg';
 children: React.ReactNode;
}

/**
 * Button component using CSS theme variables
 * NO hardcoded colors - all styles come from theme
 */
export function Button({ 
 variant = 'primary', 
 size = 'md',
 children, 
 className = '', 
 style,
 ...props 
}: ButtonProps) {
 // Size classes
 const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg'
 };

 // Base styles that don't depend on colors
 const baseClasses = `font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]}`;
 
 // CSS variable styles for each variant
 const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
   backgroundColor: 'var(--btn-primary-bg)',
   color: 'var(--btn-primary-text)',
   borderWidth: '1px',
   borderStyle: 'solid',
   borderColor: 'var(--btn-primary-border)',
  },
  secondary: {
   backgroundColor: 'var(--btn-secondary-bg)',
   color: 'var(--btn-secondary-text)',
   borderWidth: '1px',
   borderStyle: 'solid',
   borderColor: 'var(--btn-secondary-border)',
  },
  danger: {
   backgroundColor: 'var(--btn-danger-bg)',
   color: 'var(--btn-danger-text)',
   borderWidth: '1px',
   borderStyle: 'solid',
   borderColor: 'var(--btn-danger-border)',
  }
 };

 // Hover styles applied via onMouseEnter/Leave for true CSS variable support
 const [isHovered, setIsHovered] = React.useState(false);
 
 const hoverStyles: Record<string, React.CSSProperties> = {
  primary: { backgroundColor: 'var(--btn-primary-hover)' },
  secondary: { backgroundColor: 'var(--btn-secondary-hover)' },
  danger: { backgroundColor: 'var(--btn-danger-hover)' }
 };

 const combinedStyle: React.CSSProperties = {
  ...variantStyles[variant],
  ...(isHovered && !props.disabled ? hoverStyles[variant] : {}),
  ...style
 };

 return (
  <button
   className={`${baseClasses} ${className}`}
   style={combinedStyle}
   onMouseEnter={() => setIsHovered(true)}
   onMouseLeave={() => setIsHovered(false)}
   {...props}
  >
   {children}
  </button>
 );
}
