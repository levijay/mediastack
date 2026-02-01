import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import { Button } from './common/Button';

// Inline SVG icons
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const TestIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface Specification {
  name: string;
  implementation: string;
  negate: boolean;
  required: boolean;
  fields: {
    value: string | number;
    min?: number;
    max?: number;
  };
}

interface CustomFormat {
  id: string;
  name: string;
  media_type: 'movie' | 'series' | 'both';
  trash_id?: string;
  include_when_renaming: boolean;
  specifications: Specification[];
}

interface QualityProfile {
  id: string;
  name: string;
}

interface ProfileScore {
  profile_id: string;
  custom_format_id: string;
  score: number;
  format: CustomFormat;
}

const SPEC_TYPES = [
  { value: 'ReleaseTitleSpecification', label: 'Release Title (Regex)' },
  { value: 'ReleaseGroupSpecification', label: 'Release Group (Regex)' },
  { value: 'SourceSpecification', label: 'Source' },
  { value: 'ResolutionSpecification', label: 'Resolution' },
  { value: 'LanguageSpecification', label: 'Language' },
  { value: 'SizeSpecification', label: 'Size' },
  { value: 'QualityModifierSpecification', label: 'Quality Modifier' },
];

const SOURCE_OPTIONS = [
  { value: 1, label: 'CAM' },
  { value: 2, label: 'TeleCine' },
  { value: 3, label: 'TeleSync' },
  { value: 5, label: 'DVD' },
  { value: 6, label: 'TV' },
  { value: 7, label: 'WEBDL' },
  { value: 8, label: 'WEBRip' },
  { value: 9, label: 'BluRay' },
];

const RESOLUTION_OPTIONS = [
  { value: 480, label: '480p' },
  { value: 720, label: '720p' },
  { value: 1080, label: '1080p' },
  { value: 2160, label: '2160p/4K' },
];

const LANGUAGE_OPTIONS = [
  { value: 1, label: 'English' },
  { value: 3, label: 'French' },
  { value: 4, label: 'German' },
  { value: 5, label: 'Spanish' },
  { value: 6, label: 'Italian' },
  { value: 8, label: 'Japanese' },
];

const MODIFIER_OPTIONS = [
  { value: 1, label: 'REMUX' },
  { value: 2, label: 'PROPER' },
  { value: 3, label: 'REPACK' },
  { value: 4, label: 'REAL' },
];

export default function CustomFormatsSection() {
  const [formats, setFormats] = useState<CustomFormat[]>([]);
  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filterMediaType, setFilterMediaType] = useState<'all' | 'movie' | 'series' | 'both'>('all');
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<CustomFormat | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpecs, setEditSpecs] = useState<Specification[]>([]);
  const [editIncludeRename, setEditIncludeRename] = useState(false);
  const [editMediaType, setEditMediaType] = useState<'movie' | 'series' | 'both'>('both');
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importProfileIds, setImportProfileIds] = useState<string[]>([]);
  const [importUseDefaultScore, setImportUseDefaultScore] = useState(true);
  const [importMediaType, setImportMediaType] = useState<'movie' | 'series' | 'both'>('both');
  const [importDuplicates, setImportDuplicates] = useState<{name: string, newName: string}[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  
  // Test modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testTitle, setTestTitle] = useState('');
  const [testProfileId, setTestProfileId] = useState('');
  const [testResults, setTestResults] = useState<any>(null);
  
  // Profile scores state
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileScores, setProfileScores] = useState<ProfileScore[]>([]);
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<CustomFormat | null>(null);
  
  // Filtered formats
  const filteredFormats = filterMediaType === 'all' 
    ? formats 
    : formats.filter(f => f.media_type === filterMediaType || f.media_type === 'both');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      loadProfileScores(selectedProfileId);
    }
  }, [selectedProfileId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [formatsData, profilesData] = await Promise.all([
        api.getCustomFormats(),
        api.getQualityProfiles()
      ]);
      setFormats(formatsData);
      setProfiles(profilesData);
      if (profilesData.length > 0 && !selectedProfileId) {
        setSelectedProfileId(profilesData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadProfileScores = async (profileId: string) => {
    try {
      const scores = await api.getProfileCustomFormatScores(profileId);
      setProfileScores(scores);
    } catch (err) {
      console.error('Failed to load profile scores:', err);
    }
  };

  const handleCreateFormat = () => {
    setEditingFormat(null);
    setEditName('');
    setEditSpecs([{
      name: 'New Condition',
      implementation: 'ReleaseTitleSpecification',
      negate: false,
      required: true,
      fields: { value: '' }
    }]);
    setEditIncludeRename(false);
    setEditMediaType('both');
    setShowEditModal(true);
  };

  const handleEditFormat = (format: CustomFormat) => {
    setEditingFormat(format);
    setEditName(format.name);
    setEditSpecs([...format.specifications]);
    setEditIncludeRename(format.include_when_renaming);
    setEditMediaType(format.media_type || 'both');
    setShowEditModal(true);
  };

  const handleSaveFormat = async () => {
    try {
      if (!editName.trim()) {
        alert('Name is required');
        return;
      }

      if (editingFormat) {
        await api.updateCustomFormat(editingFormat.id, {
          name: editName,
          media_type: editMediaType,
          specifications: editSpecs,
          include_when_renaming: editIncludeRename
        });
      } else {
        await api.createCustomFormat({
          name: editName,
          media_type: editMediaType,
          specifications: editSpecs,
          include_when_renaming: editIncludeRename
        });
      }

      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save custom format');
    }
  };

  const handleDeleteFormat = async (format: CustomFormat) => {
    setDeleteConfirm(format);
  };

  const confirmDeleteFormat = async () => {
    if (!deleteConfirm) return;
    
    try {
      await api.deleteCustomFormat(deleteConfirm.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete custom format');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleImport = async () => {
    try {
      if (!importJson.trim()) {
        alert('Please paste JSON to import');
        return;
      }

      // Check if it's an array (bulk import) or single object
      let parsed;
      try {
        parsed = JSON.parse(importJson);
      } catch {
        alert('Invalid JSON format');
        return;
      }

      // Check for duplicate names
      const existingNames = formats.map(f => f.name.toLowerCase());
      const toImport = Array.isArray(parsed) ? parsed : [parsed];
      const duplicates: {name: string, newName: string}[] = [];
      
      for (const format of toImport) {
        if (format.name && existingNames.includes(format.name.toLowerCase())) {
          duplicates.push({ name: format.name, newName: format.name + ' (imported)' });
        }
      }

      if (duplicates.length > 0) {
        // Show duplicate resolution modal
        setImportDuplicates(duplicates);
        setPendingImportData(parsed);
        setShowDuplicateModal(true);
        return;
      }

      // No duplicates, proceed with import
      await executeImport(parsed);
    } catch (err: any) {
      alert(err.message || 'Failed to import custom format');
    }
  };

  const executeImport = async (data: any, renames?: {name: string, newName: string}[]) => {
    try {
      let parsed = data;
      
      // Apply renames if provided
      if (renames && renames.length > 0) {
        const renameMap = new Map(renames.map(r => [r.name.toLowerCase(), r.newName]));
        if (Array.isArray(parsed)) {
          parsed = parsed.map(f => ({
            ...f,
            name: renameMap.get(f.name?.toLowerCase()) || f.name
          }));
        } else if (parsed.name && renameMap.has(parsed.name.toLowerCase())) {
          parsed = { ...parsed, name: renameMap.get(parsed.name.toLowerCase()) };
        }
      }

      // Import with multiple profiles support
      if (importProfileIds.length > 0) {
        for (const profileId of importProfileIds) {
          if (Array.isArray(parsed)) {
            await api.bulkImportCustomFormats(parsed, profileId, importUseDefaultScore, importMediaType);
          } else {
            await api.importCustomFormat(parsed, profileId, undefined, importMediaType);
          }
        }
      } else {
        // Import without profile assignment
        if (Array.isArray(parsed)) {
          await api.bulkImportCustomFormats(parsed, undefined, importUseDefaultScore, importMediaType);
        } else {
          await api.importCustomFormat(parsed, undefined, undefined, importMediaType);
        }
      }

      setShowImportModal(false);
      setShowDuplicateModal(false);
      setImportJson('');
      setImportProfileIds([]);
      setImportMediaType('both');
      setImportDuplicates([]);
      setPendingImportData(null);
      loadData();
      if (importProfileIds.length > 0) {
        loadProfileScores(importProfileIds[0]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to import custom format');
    }
  };

  const handleTest = async () => {
    try {
      if (!testTitle.trim()) {
        alert('Please enter a release title to test');
        return;
      }

      const results = await api.testReleaseAgainstFormats(testTitle, testProfileId || undefined);
      setTestResults(results);
    } catch (err: any) {
      alert(err.message || 'Failed to test release');
    }
  };

  const handleScoreChange = async (formatId: string, score: number) => {
    try {
      await api.setProfileCustomFormatScore(selectedProfileId, formatId, score);
      loadProfileScores(selectedProfileId);
    } catch (err: any) {
      console.error('Failed to update score:', err);
    }
  };

  const addSpecification = () => {
    setEditSpecs([...editSpecs, {
      name: 'New Condition',
      implementation: 'ReleaseTitleSpecification',
      negate: false,
      required: true,
      fields: { value: '' }
    }]);
  };

  const updateSpecification = (index: number, updates: Partial<Specification>) => {
    const newSpecs = [...editSpecs];
    newSpecs[index] = { ...newSpecs[index], ...updates };
    setEditSpecs(newSpecs);
  };

  const removeSpecification = (index: number) => {
    setEditSpecs(editSpecs.filter((_, i) => i !== index));
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedFormats);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFormats(newExpanded);
  };

  const getSpecValueDisplay = (spec: Specification): string => {
    switch (spec.implementation) {
      case 'SourceSpecification':
        return SOURCE_OPTIONS.find(o => o.value === spec.fields.value)?.label || String(spec.fields.value);
      case 'ResolutionSpecification':
        return RESOLUTION_OPTIONS.find(o => o.value === spec.fields.value)?.label || String(spec.fields.value);
      case 'LanguageSpecification':
        return LANGUAGE_OPTIONS.find(o => o.value === spec.fields.value)?.label || String(spec.fields.value);
      case 'QualityModifierSpecification':
        return MODIFIER_OPTIONS.find(o => o.value === spec.fields.value)?.label || String(spec.fields.value);
      case 'SizeSpecification':
        return `${spec.fields.min || 0}GB - ${spec.fields.max || '∞'}GB`;
      default:
        return String(spec.fields.value);
    }
  };

  const getProfileScore = (formatId: string): number => {
    const score = profileScores.find(ps => ps.custom_format_id === formatId);
    return score?.score || 0;
  };

  if (loading) {
    return <div className="p-4">Loading custom formats...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Custom Formats</h2>
          <p className="text-sm text-gray-400 mt-1">
            Define rules to score and filter releases. Compatible with Trash Guides JSON.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2"
          >
            <TestIcon />
            Test
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2"
          >
            <UploadIcon />
            Import
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateFormat}
            className="flex items-center gap-2"
          >
            <PlusIcon />
            Add Format
          </Button>
        </div>
      </div>

      {/* Profile Score Selector - Tab Bar */}
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Profile:</span>
          <div className="flex items-center gap-1 p-1 rounded" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  selectedProfileId === p.id
                    ? 'text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                style={selectedProfileId === p.id 
                  ? { backgroundColor: 'var(--primary-color, #3b82f6)' } 
                  : { color: 'var(--text-secondary)' }
                }
              >
                {p.name}
              </button>
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Scores are saved per profile
          </span>
        </div>
      </div>

      {/* Formats List */}
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        {/* Filter Row */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--surface-bg)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Filter:</span>
            {[
              { value: 'all', label: 'All', color: null },
              { value: 'movie', label: 'Movies', color: '#7fc8f8' },
              { value: 'series', label: 'Series', color: '#ea9ab2' },
              { value: 'both', label: 'Both', color: '#ffe45e' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterMediaType(opt.value as 'all' | 'movie' | 'series' | 'both')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filterMediaType === opt.value && !opt.color ? 'bg-gray-600 text-white' : 
                  filterMediaType !== opt.value ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : ''
                }`}
                style={filterMediaType === opt.value && opt.color ? { backgroundColor: opt.color, color: '#000' } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filteredFormats.length} format{filteredFormats.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="table-responsive">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Conditions</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-32" style={{ color: 'var(--text-muted)' }}>Score</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider w-24" style={{ color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {filteredFormats.length === 0 ? (
              <tr style={{ backgroundColor: 'var(--card-bg)' }}>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {formats.length === 0 
                    ? 'No custom formats defined. Import from Trash Guides or create your own.'
                    : 'No formats match the selected filter.'}
                </td>
              </tr>
            ) : (
              filteredFormats.map(format => (
                <>
                  <tr key={format.id} style={{ backgroundColor: 'var(--card-bg)' }} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExpanded(format.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        {expandedFormats.has(format.id) ? (
                          <span style={{ color: 'var(--text-muted)' }}><ChevronDownIcon /></span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}><ChevronRightIcon /></span>
                        )}
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{format.name}</span>
                        {format.trash_id && (
                          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>(Trash Guides)</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className="px-2 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: format.media_type === 'movie' ? '#7fc8f8' :
                            format.media_type === 'series' ? '#ea9ab2' : '#ffe45e',
                          color: '#000'
                        }}
                      >
                        {format.media_type === 'movie' ? 'Movie' : format.media_type === 'series' ? 'Series' : 'Both'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {format.specifications.length} condition{format.specifications.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={getProfileScore(format.id)}
                        onChange={(e) => handleScoreChange(format.id, parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-sm"
                        style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditFormat(format)}
                          className="p-1.5 hover:bg-gray-700"
                          title="Edit"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => handleDeleteFormat(format)}
                          className="p-1.5 hover:bg-gray-700 text-red-400"
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedFormats.has(format.id) && (
                    <tr key={`${format.id}-details`} style={{ backgroundColor: 'var(--surface-bg)' }}>
                      <td colSpan={5} className="px-8 py-4">
                        <div className="space-y-2">
                          {format.specifications.map((spec, idx) => (
                            <div key={idx} className="flex items-center gap-4 text-sm">
                              <span className={`px-2 py-0.5 rounded text-xs ${spec.required ? 'bg-blue-600' : 'bg-gray-600'}`}>
                                {spec.required ? 'Required' : 'Optional'}
                              </span>
                              <span className={spec.negate ? 'text-red-400' : 'text-green-400'}>
                                {spec.negate ? 'Must NOT match' : 'Must match'}
                              </span>
                              <span className="text-gray-300">{spec.name}:</span>
                              <code className="bg-gray-900 px-2 py-0.5 rounded text-xs">
                                {getSpecValueDisplay(spec)}
                              </code>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table></div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {editingFormat ? 'Edit Custom Format' : 'New Custom Format'}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <XIcon />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  placeholder="Custom Format Name"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeRename"
                  checked={editIncludeRename}
                  onChange={(e) => setEditIncludeRename(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="includeRename" className="text-sm">Include when renaming</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Media Type</label>
                <div className="flex gap-2">
                  {[
                    { value: 'movie', label: 'Movies', color: '#7fc8f8' },
                    { value: 'series', label: 'Series', color: '#ea9ab2' },
                    { value: 'both', label: 'Both', color: '#ffe45e' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditMediaType(opt.value as 'movie' | 'series' | 'both')}
                      className={`px-3 py-1.5 text-sm rounded transition-colors ${
                        editMediaType !== opt.value ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : ''
                      }`}
                      style={editMediaType === opt.value ? { backgroundColor: opt.color, color: '#000' } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Conditions</label>
                  <button
                    onClick={addSpecification}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + Add Condition
                  </button>
                </div>
                <div className="space-y-3">
                  {editSpecs.map((spec, idx) => (
                    <div key={idx} className="bg-gray-750 p-3 rounded space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={spec.name}
                          onChange={(e) => updateSpecification(idx, { name: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                          placeholder="Condition name"
                        />
                        <button
                          onClick={() => removeSpecification(idx)}
                          className="p-1 hover:bg-gray-600 rounded text-red-400"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <select
                          value={spec.implementation}
                          onChange={(e) => updateSpecification(idx, { 
                            implementation: e.target.value,
                            fields: { value: '' }
                          })}
                          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                        >
                          {SPEC_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={spec.negate}
                            onChange={(e) => updateSpecification(idx, { negate: e.target.checked })}
                          />
                          Negate
                        </label>
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={spec.required}
                            onChange={(e) => updateSpecification(idx, { required: e.target.checked })}
                          />
                          Required
                        </label>
                      </div>
                      <div>
                        {['ReleaseTitleSpecification', 'ReleaseGroupSpecification'].includes(spec.implementation) ? (
                          <input
                            type="text"
                            value={spec.fields.value as string}
                            onChange={(e) => updateSpecification(idx, { fields: { value: e.target.value } })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono"
                            placeholder="Regex pattern (e.g. \bREMUX\b)"
                          />
                        ) : spec.implementation === 'SourceSpecification' ? (
                          <select
                            value={spec.fields.value as number}
                            onChange={(e) => updateSpecification(idx, { fields: { value: parseInt(e.target.value) } })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                          >
                            {SOURCE_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : spec.implementation === 'ResolutionSpecification' ? (
                          <select
                            value={spec.fields.value as number}
                            onChange={(e) => updateSpecification(idx, { fields: { value: parseInt(e.target.value) } })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                          >
                            {RESOLUTION_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : spec.implementation === 'LanguageSpecification' ? (
                          <select
                            value={spec.fields.value as number}
                            onChange={(e) => updateSpecification(idx, { fields: { value: parseInt(e.target.value) } })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                          >
                            {LANGUAGE_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : spec.implementation === 'QualityModifierSpecification' ? (
                          <select
                            value={spec.fields.value as number}
                            onChange={(e) => updateSpecification(idx, { fields: { value: parseInt(e.target.value) } })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                          >
                            {MODIFIER_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : spec.implementation === 'SizeSpecification' ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              value={spec.fields.min || ''}
                              onChange={(e) => updateSpecification(idx, { 
                                fields: { ...spec.fields, min: parseFloat(e.target.value) || 0 } 
                              })}
                              className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                              placeholder="Min GB"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                              type="number"
                              value={spec.fields.max || ''}
                              onChange={(e) => updateSpecification(idx, { 
                                fields: { ...spec.fields, max: parseFloat(e.target.value) || undefined } 
                              })}
                              className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                              placeholder="Max GB"
                            />
                            <span className="text-gray-400 text-sm">GB</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFormat}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Import Custom Format</h3>
              <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <XIcon />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Paste Trash Guides JSON (single format or array)
                </label>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full h-64 bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm"
                  placeholder='{"trash_id": "...", "name": "...", "specifications": [...]}'
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Media Type
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'movie', label: 'Movies', color: '#7fc8f8' },
                    { value: 'series', label: 'Series', color: '#ea9ab2' },
                    { value: 'both', label: 'Both', color: '#ffe45e' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setImportMediaType(opt.value as 'movie' | 'series' | 'both')}
                      className={`px-3 py-1.5 text-sm rounded transition-colors ${
                        importMediaType !== opt.value ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : ''
                      }`}
                      style={importMediaType === opt.value ? { backgroundColor: opt.color, color: '#000' } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  TRaSH Guides have different formats for Movies vs Series with the same names
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Assign to Quality Profiles (optional)
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-700 border border-gray-600 p-3">
                  {profiles.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-600 p-1 -m-1">
                      <input
                        type="checkbox"
                        checked={importProfileIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setImportProfileIds([...importProfileIds, p.id]);
                          } else {
                            setImportProfileIds(importProfileIds.filter(id => id !== p.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
                {importProfileIds.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {importProfileIds.length} profile{importProfileIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
              {importProfileIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useDefaultScore"
                    checked={importUseDefaultScore}
                    onChange={(e) => setImportUseDefaultScore(e.target.checked)}
                  />
                  <label htmlFor="useDefaultScore" className="text-sm">
                    Use default scores from Trash Guides
                  </label>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Name Resolution Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
          <div className="rounded-lg w-full max-w-lg" style={{ backgroundColor: 'var(--card-bg)' }}>
            <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Duplicate Names Found</h3>
              <button onClick={() => { setShowDuplicateModal(false); setImportDuplicates([]); setPendingImportData(null); }} className="p-1 hover:bg-gray-700 rounded">
                <XIcon />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                The following custom formats have names that already exist. Please rename them to continue:
              </p>
              <div className="space-y-3">
                {importDuplicates.map((dup, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm text-red-400 min-w-[150px] truncate" title={dup.name}>{dup.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <input
                      type="text"
                      value={dup.newName}
                      onChange={(e) => {
                        const updated = [...importDuplicates];
                        updated[idx] = { ...dup, newName: e.target.value };
                        setImportDuplicates(updated);
                      }}
                      className="flex-1 px-3 py-1.5 text-sm border rounded"
                      style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => { setShowDuplicateModal(false); setImportDuplicates([]); setPendingImportData(null); }}
                className="px-4 py-2 hover:bg-gray-600 rounded"
                style={{ backgroundColor: 'var(--hover-bg)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => executeImport(pendingImportData, importDuplicates)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Import with New Names
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Test Release</h3>
              <button onClick={() => { setShowTestModal(false); setTestResults(null); }} className="p-1 hover:bg-gray-700 rounded">
                <XIcon />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Release Title</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm"
                  placeholder="Movie.Name.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-GROUP"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quality Profile (for score calculation)</label>
                <select
                  value={testProfileId}
                  onChange={(e) => setTestProfileId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="">No profile (just show matches)</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleTest}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center gap-2"
              >
                <TestIcon />
                Test Release
              </button>

              {testResults && (
                <div className="bg-gray-750 p-4 rounded space-y-3">
                  <div className="font-medium">Results for: <code className="text-sm">{testResults.title}</code></div>
                  {testResults.totalScore !== undefined && (
                    <div className="text-lg">
                      Total Score: <span className={testResults.totalScore >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {testResults.totalScore}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium mb-2">Matched Formats:</div>
                    {testResults.matchedFormats.length === 0 ? (
                      <div className="text-gray-400 text-sm">No custom formats matched</div>
                    ) : (
                      <div className="space-y-1">
                        {testResults.matchedFormats.map((match: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2">
                              <span className="text-green-400"><CheckIcon /></span>
                              {match.format}
                            </span>
                            {match.score !== undefined && (
                              <span className={match.score >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {match.score > 0 ? '+' : ''}{match.score}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => { setShowTestModal(false); setTestResults(null); }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Custom Format"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDeleteFormat}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
