export function LoadingScreen() {
 return (
  <div 
   className="min-h-screen flex items-center justify-center"
   style={{ backgroundColor: 'var(--theme-background)' }}
  >
   <div className="flex flex-col items-center gap-4">
    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}></div>
    <span style={{ color: 'var(--theme-text-muted)' }}>Loading...</span>
   </div>
  </div>
 );
}
