import { useState, useEffect } from 'react';
import { PosterSizeSelector } from './PosterSizeSelector';

interface CustomFilter {
 id: string;
 name: string;
 conditions: {
  monitored?: boolean;
  hasFile?: boolean;
  cutoffMet?: boolean;
  qualityProfileId?: string;
  quality?: string;
  minYear?: number;
  maxYear?: number;
 };
}

interface QualityProfileOption {
 id: string;
 name: string;
 cutoff_quality?: string;
}

interface SmartBarProps {
 // Data
 totalItems: number;
 selectedCount: number;
 
 // Search & Filter
 searchTerm: string;
 onSearchChange: (value: string) => void;
 filter: string;
 onFilterChange: (value: string) => void;
 filterOptions: { value: string; label: string; disabled?: boolean }[];
 
 // Custom Filters
 customFilters?: CustomFilter[];
 onCustomFiltersChange?: (filters: CustomFilter[]) => void;
 qualityProfiles?: QualityProfileOption[];
 
 // View Mode
 viewMode: 'poster' | 'table';
 onViewModeChange: (mode: 'poster' | 'table') => void;
 
 // Poster Size
 posterSize: number;
 onPosterSizeChange: (size: number) => void;
 
 // Select Mode
 selectMode: boolean;
 onSelectModeChange: (enabled: boolean) => void;
 onSelectAll: () => void;
 onDeleteSelected: () => void;
 onMonitorSelected?: () => void;
 onUnmonitorSelected?: () => void;
 onSearchSelected?: () => void;
 searchingSelected?: boolean;
 onOrganizeFolders?: () => void;
 organizingFolders?: boolean;
 onSetProfile?: (profileId: string) => void;
 settingProfile?: boolean;
 onSetAvailability?: (availability: string) => void;
 settingAvailability?: boolean;
 
 // Actions
 onRefresh: () => void;
 addLink: string;
 addLabel: string;
 importLink: string;
}

export function SmartBar({
 totalItems,
 selectedCount,
 searchTerm,
 onSearchChange,
 filter,
 onFilterChange,
 filterOptions,
 customFilters = [],
 onCustomFiltersChange,
 qualityProfiles = [],
 viewMode,
 onViewModeChange,
 posterSize,
 onPosterSizeChange,
 selectMode,
 onSelectModeChange,
 onSelectAll,
 onDeleteSelected,
 onMonitorSelected,
 onUnmonitorSelected,
 onSearchSelected,
 searchingSelected,
 onOrganizeFolders,
 organizingFolders,
 onSetProfile,
 settingProfile,
 onSetAvailability,
 settingAvailability,
 onRefresh,
 addLink,
 addLabel,
 importLink
}: SmartBarProps) {
 const [showFilterModal, setShowFilterModal] = useState(false);
 const [editingFilter, setEditingFilter] = useState<CustomFilter | null>(null);

 return (
  <>
  <div className="sticky top-0 z-20 -mx-4 px-4 py-3" style={{ backgroundColor: 'var(--theme-background)' }}>
   {/* Main toolbar */}
   <div className="flex items-center gap-2 flex-wrap p-3 border" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
    {/* Search */}
    <div className="relative flex-1 min-w-[200px] max-w-md">
     <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
     </svg>
     <input
      type="text"
      placeholder="Search..."
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
      className="w-full pl-10 pr-4 py-2 text-sm border transition-colors"
      style={{
       backgroundColor: 'var(--input-bg)',
       borderColor: 'var(--input-border)',
       color: 'var(--input-text)'
      }}
     />
    </div>
    
    {/* Filter dropdown */}
    <select
     value={filter}
     onChange={(e) => {
      if (e.target.value === 'manage_filters') {
       setEditingFilter(null);
       setShowFilterModal(true);
      } else {
       onFilterChange(e.target.value);
      }
     }}
     className="px-3 py-2 text-sm border transition-colors"
     style={{
      backgroundColor: 'var(--input-bg)',
      borderColor: 'var(--input-border)',
      color: 'var(--input-text)'
     }}
    >
     {filterOptions.map(opt => (
      <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
     ))}
     {customFilters.length > 0 && <option disabled>───────────</option>}
     {customFilters.map(f => (
      <option key={f.id} value={f.id}>{f.name}</option>
     ))}
     {onCustomFiltersChange && (
      <>
       <option disabled>───────────</option>
       <option value="manage_filters">Custom Filters...</option>
      </>
     )}
    </select>
    
    {/* Item count */}
    <span className="text-sm px-2" style={{ color: 'var(--text-secondary)' }}>
     {totalItems} items
    </span>
    
    {/* Divider */}
    <div className="h-6 w-px mx-1" style={{ backgroundColor: 'var(--border-color)' }} />
    
    {/* View mode toggle */}
    <div className="flex items-center overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
     <button
      onClick={() => onViewModeChange('poster')}
      className="p-2 transition-colors"
      style={{
       backgroundColor: viewMode === 'poster' ? 'var(--btn-primary-bg)' : 'var(--surface-bg)',
       color: viewMode === 'poster' ? 'var(--btn-primary-text)' : 'var(--text-secondary)'
      }}
      title="Poster View"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
     </button>
     <button
      onClick={() => onViewModeChange('table')}
      className="p-2 transition-colors"
      style={{
       backgroundColor: viewMode === 'table' ? 'var(--btn-primary-bg)' : 'var(--surface-bg)',
       color: viewMode === 'table' ? 'var(--btn-primary-text)' : 'var(--text-secondary)'
      }}
      title="Table View"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
     </button>
    </div>
    
    {/* Poster size (only in poster view) */}
    {viewMode === 'poster' && (
     <PosterSizeSelector value={posterSize} onChange={onPosterSizeChange} />
    )}
    
    {/* Divider */}
    <div className="h-6 w-px mx-1" style={{ backgroundColor: 'var(--border-color)' }} />
    
    {/* Select mode toggle */}
    <button
     onClick={() => onSelectModeChange(!selectMode)}
     className={`flex items-center gap-1.5 px-3 py-2 text-sm border transition-colors ${selectMode ? 'ring-2 ring-primary-500' : ''}`}
     style={{
      backgroundColor: selectMode ? 'var(--btn-primary-bg)' : 'var(--surface-bg)',
      borderColor: 'var(--border-color)',
      color: selectMode ? 'var(--btn-primary-text)' : 'var(--text-secondary)'
     }}
     title="Select Mode"
    >
     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
     </svg>
     {selectMode ? `${selectedCount} selected` : 'Select'}
    </button>
    
    {/* Refresh button */}
    <button
     onClick={onRefresh}
     className="p-2 border transition-colors hover:bg-opacity-80"
     style={{
      backgroundColor: 'var(--surface-bg)',
      borderColor: 'var(--border-color)',
      color: 'var(--text-secondary)'
     }}
     title="Refresh Library"
    >
     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
     </svg>
    </button>
    
    {/* Add button */}
    <a
     href={addLink}
     className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
     style={{
      backgroundColor: 'var(--btn-primary-bg)',
      color: 'var(--btn-primary-text)'
     }}
    >
     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
     </svg>
     {addLabel}
    </a>
    
    {/* Import button */}
    <a
     href={importLink}
     className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
     style={{
      backgroundColor: 'var(--btn-primary-bg)',
      color: 'var(--btn-primary-text)'
     }}
    >
     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
     </svg>
     Import
    </a>
   </div>
   
   {/* Bulk actions bar (when in select mode) */}
   {selectMode && (
    <div className="flex items-center gap-3 mt-3 p-3 " style={{ backgroundColor: 'var(--surface-bg)' }}>
     <button
      onClick={onSelectAll}
      className="px-3 py-1.5 text-sm transition-colors"
      style={{
       backgroundColor: 'var(--hover-bg)',
       color: 'var(--text-primary)'
      }}
     >
      {selectedCount === totalItems ? 'Deselect All' : 'Select All'}
     </button>
     
     {/* Monitor/Unmonitor buttons */}
     {onMonitorSelected && (
      <button
       onClick={onMonitorSelected}
       disabled={selectedCount === 0}
       className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
       style={{
        backgroundColor: 'var(--hover-bg)',
        color: 'var(--text-primary)'
       }}
      >
       <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
       </svg>
       Monitor
      </button>
     )}
     {onUnmonitorSelected && (
      <button
       onClick={onUnmonitorSelected}
       disabled={selectedCount === 0}
       className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
       style={{
        backgroundColor: 'var(--hover-bg)',
        color: 'var(--text-primary)'
       }}
      >
       <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
       </svg>
       Unmonitor
      </button>
     )}
     
     {/* Search Selected button */}
     {onSearchSelected && (
      <button
       onClick={onSearchSelected}
       disabled={selectedCount === 0 || searchingSelected}
       className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
       style={{
        backgroundColor: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)'
       }}
      >
       {searchingSelected ? (
        <>
         <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
         </svg>
         Searching...
        </>
       ) : (
        <>
         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
         </svg>
         Search ({selectedCount})
        </>
       )}
      </button>
     )}

     {/* Organize Folders button */}
     {onOrganizeFolders && (
      <button
       onClick={onOrganizeFolders}
       disabled={selectedCount === 0 || organizingFolders}
       className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
       style={{
        backgroundColor: 'var(--hover-bg)',
        color: 'var(--text-primary)'
       }}
      >
       {organizingFolders ? (
        <>
         <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
         </svg>
         Renaming...
        </>
       ) : (
        <>
         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
         </svg>
         Rename Folders
        </>
       )}
      </button>
     )}

     {/* Set Profile dropdown */}
     {onSetProfile && qualityProfiles.length > 0 && (
      <div className="relative">
       <select
        disabled={selectedCount === 0 || settingProfile}
        onChange={(e) => {
         if (e.target.value) {
          onSetProfile(e.target.value);
          e.target.value = ''; // Reset after selection
         }
        }}
        className="appearance-none pl-3 pr-8 py-1.5 text-sm transition-colors disabled:opacity-50 cursor-pointer"
        style={{
         backgroundColor: 'var(--hover-bg)',
         color: 'var(--text-primary)',
         border: '1px solid var(--border-color)'
        }}
        defaultValue=""
       >
        <option value="" disabled>
         {settingProfile ? 'Setting...' : 'Set Profile'}
        </option>
        {qualityProfiles.map(profile => (
         <option key={profile.id} value={profile.id}>{profile.name}</option>
        ))}
       </select>
       <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
       </svg>
      </div>
     )}

     {/* Set Availability dropdown */}
     {onSetAvailability && (
      <div className="relative">
       <select
        disabled={selectedCount === 0 || settingAvailability}
        onChange={(e) => {
         if (e.target.value) {
          onSetAvailability(e.target.value);
          e.target.value = ''; // Reset after selection
         }
        }}
        className="appearance-none pl-3 pr-8 py-1.5 text-sm transition-colors disabled:opacity-50 cursor-pointer"
        style={{
         backgroundColor: 'var(--hover-bg)',
         color: 'var(--text-primary)',
         border: '1px solid var(--border-color)'
        }}
        defaultValue=""
       >
        <option value="" disabled>
         {settingAvailability ? 'Setting...' : 'Set Availability'}
        </option>
        <option value="announced">Announced</option>
        <option value="inCinemas">In Cinemas</option>
        <option value="released">Released</option>
       </select>
       <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
       </svg>
      </div>
     )}
     
     <button
      onClick={onDeleteSelected}
      disabled={selectedCount === 0}
      className="px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
      style={{
       backgroundColor: 'var(--btn-danger-bg)',
       color: 'white'
      }}
     >
      Delete ({selectedCount})
     </button>
     <button
      onClick={() => onSelectModeChange(false)}
      className="px-3 py-1.5 text-sm transition-colors"
      style={{
       backgroundColor: 'var(--hover-bg)',
       color: 'var(--text-secondary)'
      }}
     >
      Cancel
     </button>
    </div>
   )}
  </div>

  {/* Custom Filter Modal */}
  {showFilterModal && onCustomFiltersChange && (
   <CustomFilterModal
    key={editingFilter?.id || 'new'}
    filter={editingFilter}
    qualityProfiles={qualityProfiles}
    existingFilters={customFilters}
    onSave={(newFilter) => {
     if (editingFilter) {
      onCustomFiltersChange(customFilters.map(f => f.id === newFilter.id ? newFilter : f));
     } else {
      onCustomFiltersChange([...customFilters, newFilter]);
     }
     setShowFilterModal(false);
     setEditingFilter(null);
    }}
    onDelete={editingFilter ? () => {
     onCustomFiltersChange(customFilters.filter(f => f.id !== editingFilter.id));
     if (filter === editingFilter.id) onFilterChange('all');
     setShowFilterModal(false);
     setEditingFilter(null);
    } : undefined}
    onClose={() => {
     setShowFilterModal(false);
     setEditingFilter(null);
    }}
    onEditFilter={(f) => setEditingFilter(f)}
   />
  )}
  </>
 );
}

// Custom Filter Modal Component
function CustomFilterModal({
 filter,
 qualityProfiles,
 existingFilters,
 onSave,
 onDelete,
 onClose,
 onEditFilter
}: {
 filter: CustomFilter | null;
 qualityProfiles: QualityProfileOption[];
 existingFilters: CustomFilter[];
 onSave: (filter: CustomFilter) => void;
 onDelete?: () => void;
 onClose: () => void;
 onEditFilter: (filter: CustomFilter) => void;
}) {
 const [name, setName] = useState(filter?.name || '');
 const [monitored, setMonitored] = useState<'any' | 'true' | 'false'>(
  filter?.conditions.monitored === undefined ? 'any' : filter.conditions.monitored ? 'true' : 'false'
 );
 const [hasFile, setHasFile] = useState<'any' | 'true' | 'false'>(
  filter?.conditions.hasFile === undefined ? 'any' : filter.conditions.hasFile ? 'true' : 'false'
 );
 const [cutoffMet, setCutoffMet] = useState<'any' | 'true' | 'false'>(
  filter?.conditions.cutoffMet === undefined ? 'any' : filter.conditions.cutoffMet ? 'true' : 'false'
 );
 const [qualityProfileId, setQualityProfileId] = useState(filter?.conditions.qualityProfileId || '');
 const [quality, setQuality] = useState(filter?.conditions.quality || '');
 const [minYear, setMinYear] = useState(filter?.conditions.minYear?.toString() || '');
 const [maxYear, setMaxYear] = useState(filter?.conditions.maxYear?.toString() || '');
 const [showForm, setShowForm] = useState(filter !== null || existingFilters.length === 0);

 // Available quality options - includes both specific qualities and resolution groups
 const qualityOptions = [
  // Resolution groups (will match any quality at that resolution)
  { value: '2160p', label: '2160p (Any)' },
  { value: '1080p', label: '1080p (Any)' },
  { value: '720p', label: '720p (Any)' },
  { value: '480p', label: '480p (Any)' },
  // Specific qualities
  { value: 'Bluray-2160p', label: 'Bluray 2160p' },
  { value: 'WEB 2160p', label: 'WEB 2160p' },
  { value: 'Remux-2160p', label: 'Remux 2160p' },
  { value: 'Bluray-1080p', label: 'Bluray 1080p' },
  { value: 'WEB 1080p', label: 'WEB 1080p' },
  { value: 'Remux-1080p', label: 'Remux 1080p' },
  { value: 'HDTV-1080p', label: 'HDTV 1080p' },
  { value: 'Bluray-720p', label: 'Bluray 720p' },
  { value: 'WEB 720p', label: 'WEB 720p' },
  { value: 'HDTV-720p', label: 'HDTV 720p' },
  { value: 'DVD', label: 'DVD' },
  { value: 'SDTV', label: 'SDTV' },
 ];

 // Update form when filter prop changes (for editing)
 useEffect(() => {
  if (filter) {
   setName(filter.name || '');
   setMonitored(filter.conditions.monitored === undefined ? 'any' : filter.conditions.monitored ? 'true' : 'false');
   setHasFile(filter.conditions.hasFile === undefined ? 'any' : filter.conditions.hasFile ? 'true' : 'false');
   setCutoffMet(filter.conditions.cutoffMet === undefined ? 'any' : filter.conditions.cutoffMet ? 'true' : 'false');
   setQualityProfileId(filter.conditions.qualityProfileId || '');
   setQuality(filter.conditions.quality || '');
   setMinYear(filter.conditions.minYear?.toString() || '');
   setMaxYear(filter.conditions.maxYear?.toString() || '');
   setShowForm(true);
  }
 }, [filter]);

 const handleSave = () => {
  if (!name.trim()) return;
  
  const conditions: CustomFilter['conditions'] = {};
  if (monitored !== 'any') conditions.monitored = monitored === 'true';
  if (hasFile !== 'any') conditions.hasFile = hasFile === 'true';
  if (cutoffMet !== 'any') conditions.cutoffMet = cutoffMet === 'true';
  if (qualityProfileId) conditions.qualityProfileId = qualityProfileId;
  if (quality) conditions.quality = quality;
  if (minYear) conditions.minYear = parseInt(minYear);
  if (maxYear) conditions.maxYear = parseInt(maxYear);
  
  onSave({
   id: filter?.id || `custom_${Date.now()}`,
   name: name.trim(),
   conditions
  });
 };

 return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
   <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
    {/* Header */}
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
     <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      {filter ? 'Edit Filter' : showForm ? 'New Custom Filter' : 'Custom Filters'}
     </h2>
    </div>

    <div className="flex-1 overflow-y-auto p-6">
     {!showForm ? (
      /* Filter List */
      <div className="space-y-4">
       {existingFilters.length > 0 ? (
        <div className="space-y-2">
         {existingFilters.map(f => (
          <div
           key={f.id}
           className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
          >
           <div>
            <p className="font-medium text-gray-900 dark:text-white">{f.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
             {Object.entries(f.conditions).map(([key, value]) => {
              if (key === 'monitored') return value ? 'Monitored' : 'Unmonitored';
              if (key === 'hasFile') return value ? 'Has File' : 'Missing File';
              if (key === 'cutoffMet') return value ? 'Cutoff Met' : 'Cutoff Unmet';
              if (key === 'qualityProfileId') return `Profile: ${qualityProfiles.find(p => p.id === value)?.name || value}`;
              if (key === 'quality') return `Quality: ${value}`;
              if (key === 'minYear') return `From: ${value}`;
              if (key === 'maxYear') return `To: ${value}`;
              return '';
             }).filter(Boolean).join(', ')}
            </p>
           </div>
           <button
            onClick={() => onEditFilter(f)}
            className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
           >
            Edit
           </button>
          </div>
         ))}
        </div>
       ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
         No custom filters yet
        </p>
       )}
       <button
        onClick={() => setShowForm(true)}
        className="w-full px-4 py-2 text-sm font-medium text-primary-600 border border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
       >
        + Create New Filter
       </button>
      </div>
     ) : (
      /* Filter Form */
      <div className="space-y-4">
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Filter Name
        </label>
        <input
         type="text"
         value={name}
         onChange={(e) => setName(e.target.value)}
         placeholder="My Custom Filter"
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
       </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Monitored Status
        </label>
        <select
         value={monitored}
         onChange={(e) => setMonitored(e.target.value as any)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="any">Any</option>
         <option value="true">Monitored Only</option>
         <option value="false">Unmonitored Only</option>
        </select>
       </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         File Status
        </label>
        <select
         value={hasFile}
         onChange={(e) => setHasFile(e.target.value as any)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="any">Any</option>
         <option value="true">Has File</option>
         <option value="false">Missing File</option>
        </select>
       </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Cutoff Status
        </label>
        <select
         value={cutoffMet}
         onChange={(e) => setCutoffMet(e.target.value as any)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="any">Any</option>
         <option value="true">Cutoff Met</option>
         <option value="false">Cutoff Not Met</option>
        </select>
       </div>

       {qualityProfiles.length > 0 && (
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Quality Profile
         </label>
         <select
          value={qualityProfileId}
          onChange={(e) => setQualityProfileId(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
         >
          <option value="">Any Profile</option>
          {qualityProfiles.map(profile => (
           <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
         </select>
        </div>
       )}

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Downloaded Quality
        </label>
        <select
         value={quality}
         onChange={(e) => setQuality(e.target.value)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="">Any Quality</option>
         {qualityOptions.map(q => (
          <option key={q.value} value={q.value}>{q.label}</option>
         ))}
        </select>
       </div>

       <div className="grid grid-cols-2 gap-4">
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Min Year
         </label>
         <input
          type="number"
          value={minYear}
          onChange={(e) => setMinYear(e.target.value)}
          placeholder="e.g. 2000"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
         />
        </div>
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Max Year
         </label>
         <input
          type="number"
          value={maxYear}
          onChange={(e) => setMaxYear(e.target.value)}
          placeholder="e.g. 2024"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
         />
        </div>
       </div>
      </div>
     )}
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
     {showForm && onDelete && (
      <button
       onClick={onDelete}
       className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
       Delete
      </button>
     )}
     <div className="flex-1" />
     {showForm && existingFilters.length > 0 && !filter && (
      <button
       onClick={() => setShowForm(false)}
       className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
       Back
      </button>
     )}
     <button
      onClick={onClose}
      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
     >
      {showForm ? 'Cancel' : 'Close'}
     </button>
     {showForm && (
      <button
       onClick={handleSave}
       disabled={!name.trim()}
       className="px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
      >
       {filter ? 'Save Changes' : 'Create Filter'}
      </button>
     )}
    </div>
   </div>
  </div>
 );
}
