import { useState } from 'react';

interface PaginationProps {
 currentPage: number;
 totalItems: number;
 itemsPerPage: number;
 onPageChange: (page: number) => void;
 onItemsPerPageChange: (items: number) => void;
 itemsPerPageOptions?: number[];
}

export function Pagination({
 currentPage,
 totalItems,
 itemsPerPage,
 onPageChange,
 onItemsPerPageChange,
 itemsPerPageOptions = [10, 25, 50, 100]
}: PaginationProps) {
 const totalPages = Math.ceil(totalItems / itemsPerPage);
 const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
 const endItem = Math.min(currentPage * itemsPerPage, totalItems);

 const getPageNumbers = () => {
  const pages: (number | string)[] = [];
  const showPages = 5;
  
  if (totalPages <= showPages + 2) {
   for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
   pages.push(1);
   
   if (currentPage > 3) pages.push('...');
   
   const start = Math.max(2, currentPage - 1);
   const end = Math.min(totalPages - 1, currentPage + 1);
   
   for (let i = start; i <= end; i++) pages.push(i);
   
   if (currentPage < totalPages - 2) pages.push('...');
   
   pages.push(totalPages);
  }
  
  return pages;
 };

 if (totalItems === 0) return null;

 return (
  <div 
   className="flex items-center justify-between px-4 py-3 border-t"
   style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
  >
   {/* Items per page selector */}
   <div className="flex items-center gap-2">
    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
     Show
    </span>
    <select
     value={itemsPerPage}
     onChange={(e) => {
      onItemsPerPageChange(Number(e.target.value));
      onPageChange(1); // Reset to first page
     }}
     className="px-2 py-1 rounded text-sm focus:outline-none focus:ring-2"
     style={{ 
      backgroundColor: 'var(--input-bg)', 
      borderColor: 'var(--input-border)', 
      color: 'var(--input-text)',
      border: '1px solid var(--input-border)'
     }}
    >
     {itemsPerPageOptions.map(option => (
      <option key={option} value={option}>{option}</option>
     ))}
    </select>
    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
     per page
    </span>
   </div>

   {/* Page info */}
   <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
    Showing {startItem} - {endItem} of {totalItems}
   </div>

   {/* Page navigation */}
   <div className="flex items-center gap-1">
    {/* Previous button */}
    <button
     onClick={() => onPageChange(currentPage - 1)}
     disabled={currentPage === 1}
     className="p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
     style={{ color: 'var(--text-secondary)' }}
     onMouseOver={(e) => currentPage !== 1 && (e.currentTarget.style.backgroundColor = 'var(--hover-bg)')}
     onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
     </svg>
    </button>

    {/* Page numbers */}
    {getPageNumbers().map((page, index) => (
     <button
      key={index}
      onClick={() => typeof page === 'number' && onPageChange(page)}
      disabled={page === '...'}
      className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium transition-colors ${
       page === currentPage ? 'ring-2' : ''
      }`}
      style={{ 
       backgroundColor: page === currentPage ? 'var(--btn-primary-bg)' : 'transparent',
       color: page === currentPage ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
       cursor: page === '...' ? 'default' : 'pointer'
      }}
      onMouseOver={(e) => page !== currentPage && page !== '...' && (e.currentTarget.style.backgroundColor = 'var(--hover-bg)')}
      onMouseOut={(e) => page !== currentPage && (e.currentTarget.style.backgroundColor = 'transparent')}
     >
      {page}
     </button>
    ))}

    {/* Next button */}
    <button
     onClick={() => onPageChange(currentPage + 1)}
     disabled={currentPage === totalPages}
     className="p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
     style={{ color: 'var(--text-secondary)' }}
     onMouseOver={(e) => currentPage !== totalPages && (e.currentTarget.style.backgroundColor = 'var(--hover-bg)')}
     onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
     </svg>
    </button>
   </div>
  </div>
 );
}

// Hook for pagination state management
export function usePagination(initialItemsPerPage: number = 25) {
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

 const paginateItems = <T,>(items: T[]): T[] => {
  const start = (currentPage - 1) * itemsPerPage;
  return items.slice(start, start + itemsPerPage);
 };

 const resetPage = () => setCurrentPage(1);

 return {
  currentPage,
  setCurrentPage,
  itemsPerPage,
  setItemsPerPage,
  paginateItems,
  resetPage
 };
}
