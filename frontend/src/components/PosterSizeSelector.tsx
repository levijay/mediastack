interface PosterSizeSelectorProps {
 value: number;
 onChange: (size: number) => void;
}

export function PosterSizeSelector({ value, onChange }: PosterSizeSelectorProps) {
 // Map numeric values to size categories: 1-3 = small, 4-6 = medium, 7-10 = large
 const getCategory = (v: number): 'small' | 'medium' | 'large' => {
  if (v <= 3) return 'small';
  if (v <= 6) return 'medium';
  return 'large';
 };
 
 const currentCategory = getCategory(value);
 
 // Map category back to a representative numeric value
 const categoryToValue = {
  small: 2,
  medium: 5,
  large: 8,
 };

 const sizes: Array<{ key: 'small' | 'medium' | 'large'; label: string }> = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
 ];

 return (
  <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: 'var(--hover-bg)' }}>
   {sizes.map((size) => (
    <button
     key={size.key}
     onClick={() => onChange(categoryToValue[size.key])}
     className="p-2 rounded-md transition-colors"
     style={{
      backgroundColor: currentCategory === size.key ? 'var(--navbar-bg)' : 'transparent',
     }}
     title={`${size.label} posters`}
    >
     <svg 
      className="w-4 h-4" 
      viewBox="0 0 16 16" 
      fill="none"
      style={{ color: currentCategory === size.key ? 'var(--navbar-text)' : 'var(--text-secondary)' }}
     >
      {size.key === 'small' && (
       // 6 small squares (3x2 grid) - many small items
       <>
        <rect x="1" y="1" width="4" height="6" rx="0.5" fill="currentColor" />
        <rect x="6" y="1" width="4" height="6" rx="0.5" fill="currentColor" />
        <rect x="11" y="1" width="4" height="6" rx="0.5" fill="currentColor" />
        <rect x="1" y="9" width="4" height="6" rx="0.5" fill="currentColor" />
        <rect x="6" y="9" width="4" height="6" rx="0.5" fill="currentColor" />
        <rect x="11" y="9" width="4" height="6" rx="0.5" fill="currentColor" />
       </>
      )}
      {size.key === 'medium' && (
       // 4 medium squares (2x2 grid)
       <>
        <rect x="1" y="1" width="6" height="6" rx="0.5" fill="currentColor" />
        <rect x="9" y="1" width="6" height="6" rx="0.5" fill="currentColor" />
        <rect x="1" y="9" width="6" height="6" rx="0.5" fill="currentColor" />
        <rect x="9" y="9" width="6" height="6" rx="0.5" fill="currentColor" />
       </>
      )}
      {size.key === 'large' && (
       // 2 large rectangles - few large items
       <>
        <rect x="1" y="1" width="6" height="14" rx="0.5" fill="currentColor" />
        <rect x="9" y="1" width="6" height="14" rx="0.5" fill="currentColor" />
       </>
      )}
     </svg>
    </button>
   ))}
  </div>
 );
}

// Grid configurations for poster sizes
export const posterSizeConfig: Record<number, { grid: string }> = {
 1: { grid: 'grid-cols-[repeat(auto-fill,minmax(80px,80px))]' },
 2: { grid: 'grid-cols-[repeat(auto-fill,minmax(100px,100px))]' },
 3: { grid: 'grid-cols-[repeat(auto-fill,minmax(120px,120px))]' },
 4: { grid: 'grid-cols-[repeat(auto-fill,minmax(140px,140px))]' },
 5: { grid: 'grid-cols-[repeat(auto-fill,minmax(160px,160px))]' },
 6: { grid: 'grid-cols-[repeat(auto-fill,minmax(180px,180px))]' },
 7: { grid: 'grid-cols-[repeat(auto-fill,minmax(200px,200px))]' },
 8: { grid: 'grid-cols-[repeat(auto-fill,minmax(220px,220px))]' },
 9: { grid: 'grid-cols-[repeat(auto-fill,minmax(250px,250px))]' },
 10: { grid: 'grid-cols-[repeat(auto-fill,minmax(280px,280px))]' },
};
