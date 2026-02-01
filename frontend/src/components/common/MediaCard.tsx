import { getCachedImageUrl } from '../../services/api';

interface MediaCardProps {
 title: string;
 posterPath: string | null;
 year?: string;
 rating?: number;
 mediaType: 'movie' | 'tv';
 onRequest?: () => void;
}

export function MediaCard({ title, posterPath, year, rating, mediaType, onRequest }: MediaCardProps) {
 const posterUrl = getCachedImageUrl(posterPath, 'w500') || '/placeholder.png';

 return (
  <div className="bg-white shadow overflow-hidden hover:shadow-lg transition-shadow">
   <div className="relative aspect-[2/3] bg-gray-200">
    <img 
     src={posterUrl} 
     alt={title}
     className="w-full h-full object-cover"
     onError={(e) => {
      (e.target as HTMLImageElement).src = '/placeholder.png';
     }}
    />
    <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
     {mediaType === 'movie' ? '🎬' : '📺'}
    </div>
   </div>
   <div className="p-4">
    <h3 className="font-semibold text-gray-900 truncate" title={title}>
     {title}
    </h3>
    <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
     <span>{year}</span>
     {rating && (
      <span className="flex items-center">
       ⭐ {rating.toFixed(1)}
      </span>
     )}
    </div>
    {onRequest && (
     <button
      onClick={onRequest}
      className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded transition-colors"
     >
      Request
     </button>
    )}
   </div>
  </div>
 );
}
