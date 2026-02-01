# MediaStack v1.0.0

**Unified Media Management Platform** - A modern, all-in-one solution for managing your movie and TV library.

MediaStack combines the functionality of Radarr, Sonarr, and Overseerr into a single, streamlined application with a beautiful, responsive interface.

## Features

### 📚 Library Management
- **Movies & TV Series** - Full library management with metadata from TMDB
- **Quality Profiles** - Customize quality preferences with cutoff and upgrade settings
- **Custom Formats** - Score releases based on codecs, resolution, release groups, etc.
- **File Naming** - Configurable naming patterns for movies and episodes
- **Multi-file Support** - Handle movies with multiple files (editions, extras)

### 🔍 Media Discovery
- **TMDB Integration** - Search and browse movies and TV shows
- **Trending & Popular** - Discover what's popular right now
- **Actor/Person Pages** - View filmographies with library status indicators
- **Related Media** - See recommendations and similar titles

### 🔄 Automation
- **Automatic Search** - Find and download missing media automatically
- **RSS Sync** - Monitor indexer feeds for new releases (every 15 minutes)
- **Quality Upgrades** - Automatically upgrade to better quality when available
- **Proper/Repack Support** - Grab improved releases automatically
- **Import Lists** - Sync from Trakt, TMDB lists, Plex watchlists, and more

### 📥 Download Management
- **Multiple Indexers** - Support for Torznab and Newznab indexers
- **Download Clients** - Integration with qBittorrent and SABnzbd
- **Activity Monitoring** - Track downloads in real-time
- **Manual Import** - Import existing media with proper naming
- **Blacklisting** - Block unwanted releases

### 🔔 Notifications
- **Multiple Services** - Discord, Telegram, Email, Pushover, Slack, Gotify, Webhook
- **Event Triggers** - Grab, download, import, upgrade, health issues
- **Per-event Configuration** - Choose which events trigger notifications

### 🛠️ System
- **Background Workers** - Automated tasks for syncing, searching, cleanup
- **Database Backup** - Scheduled automatic backups
- **Activity History** - Full audit log of all actions
- **Health Monitoring** - System status and issue detection
- **Dark/Light Themes** - Multiple color schemes

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Unraid 6.9.0+ (or any Docker host)

### Installation

1. **Extract the archive**
   ```bash
   tar -xzvf mediastack-v1.0.0.tar.gz
   cd mediastack
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Generate a secure JWT secret**
   ```bash
   openssl rand -base64 32
   ```
   Add it to your `.env` file as `JWT_SECRET=your_generated_secret`

4. **Configure your paths** in `.env`:
   ```bash
   DATA_PATH=/mnt/user/data
   CONFIG_PATH=/mnt/user/appdata/mediastack
   ```

5. **Start MediaStack**
   ```bash
   docker-compose up -d
   ```

6. **Access the web interface**
   ```
   http://[YOUR-IP]:6767
   ```

7. **Create your admin account**
   - First user automatically becomes admin
   - Add your TMDB API key in Settings → General

## Configuration

### Environment Variables

```bash
# Required
JWT_SECRET=your-secure-secret-here
TMDB_API_KEY=your-tmdb-api-key

# Paths (adjust for your setup)
DATA_PATH=/mnt/user/data
CONFIG_PATH=/mnt/user/appdata/mediastack

# Optional
AUTH_DISABLED=true         # Set to false to require login
PUID=99                    # User ID (default: 99)
PGID=100                   # Group ID (default: 100)
TZ=America/New_York        # Timezone
PORT=6767                  # Web interface port
LOG_LEVEL=info             # Logging level (debug, info, warn, error)
```

### Initial Setup Checklist

1. **TMDB API Key** - Settings → General → TMDB API Key
2. **Root Folders** - Settings → Media Management → Add movie and TV root folders
3. **Quality Profiles** - Settings → Profiles → Create or customize profiles
4. **Indexers** - Settings → Indexers → Add your Torznab/Newznab indexers
5. **Download Clients** - Settings → Download Clients → Add qBittorrent or SABnzbd
6. **Notifications** (optional) - Settings → Notifications → Configure alerts

## Directory Structure

```
/mnt/user/appdata/mediastack/
├── config/
│   ├── mediastack.db       # SQLite database
│   └── backups/            # Database backups
├── logs/
│   ├── combined.log
│   └── error.log
└── docker-compose.yml
```

## Background Workers

MediaStack runs several background tasks automatically:

| Worker | Interval | Description |
|--------|----------|-------------|
| Download Sync | 5 seconds | Monitors download client status |
| RSS Sync | 15 minutes | Checks indexer RSS feeds for new releases |
| Missing Search | 1 hour | Searches for missing monitored media |
| Cutoff Search | 6 hours | Searches for quality upgrades |
| Library Refresh | 1 hour | Scans folders for file changes |
| Metadata Refresh | 24 hours | Updates metadata from TMDB |
| Import List Sync | 1 hour | Syncs external lists |
| Activity Cleanup | 24 hours | Removes old activity logs |
| Database Backup | Configurable | Scheduled database backups |

## API

MediaStack provides a REST API for all functionality. Generate an API key in Settings → General.

### Authentication
Include your API key in requests:
```bash
curl -H "X-Api-Key: your-api-key" http://localhost:6767/api/movies
```

### Key Endpoints
- `GET /api/movies` - List all movies
- `GET /api/series` - List all TV series
- `POST /api/movies` - Add a movie
- `POST /api/series` - Add a TV series
- `GET /api/search/movie?query=...` - Search TMDB for movies
- `GET /api/search/tv?query=...` - Search TMDB for TV shows
- `GET /api/system/status` - System status
- `GET /api/system/health` - Health check

## Troubleshooting

### Cannot access web interface
```bash
# Check if container is running
docker ps | grep mediastack

# Check logs
docker logs mediastack-api
```

### Search returns no results
- Verify indexers are configured and enabled
- Check indexer has "Enable Interactive Search" checked
- Review logs for search errors

### Downloads not starting
- Verify download client is configured and reachable
- Check download client credentials
- Ensure category/label is set correctly

### Files not importing
- Check root folder permissions
- Verify naming format is valid
- Check activity log for import errors

## Migration from Radarr/Sonarr

MediaStack can import your existing library:

1. Point root folders to same locations as Radarr/Sonarr
2. Run Library Refresh to scan existing files
3. Use bulk import to match with TMDB metadata

## Security Notes

⚠️ **For Production Use:**

1. **Change JWT_SECRET** - Generate a unique secure secret
2. **Use HTTPS** - Put behind a reverse proxy (Nginx, Traefik, Caddy)
3. **Regular backups** - Enable scheduled database backups
4. **Strong passwords** - Use strong passwords for all accounts
5. **Firewall** - Restrict access to trusted networks

## Support

- 📖 [Documentation](https://docs.mediastack.app)
- 🐛 [Report Issues](https://github.com/mediastack/mediastack/issues)
- 💬 [Discord Community](https://discord.gg/mediastack)

## License

MIT License - see LICENSE file

## Acknowledgments

Inspired by the excellent work of:
- Radarr - Movie automation
- Sonarr - TV automation
- Jellyseerr/Overseerr - Request management
- Prowlarr - Indexer management

---

**Version**: 1.0.0  
**Release Date**: February 2026

## Changelog

### v1.0.0 (February 2026)
- ✅ Full movie and TV series management
- ✅ Quality profiles with custom formats
- ✅ RSS sync with direct grabbing (15 min intervals)
- ✅ Upgrade/Proper/Repack support in RSS
- ✅ Actor/person detail pages with filmography
- ✅ Clickable cast/crew throughout the app
- ✅ Import lists (Trakt, TMDB, Plex, etc.)
- ✅ Multiple notification services
- ✅ Manual import with proper naming
- ✅ Improved search matching (article handling, year tolerance)
- ✅ Background workers process full library
- ✅ Mobile-responsive UI improvements

<img width="1780" height="1160" alt="image" src="https://github.com/user-attachments/assets/d242b603-4bba-41cd-9f99-a75eab8a695e" />
<img width="1790" height="1186" alt="image" src="https://github.com/user-attachments/assets/0714b57a-f7ff-46b6-afe3-e66ee09d0116" />
<img width="1785" height="995" alt="image" src="https://github.com/user-attachments/assets/774318ea-1e07-4bb9-826a-8ccd821837e6" />
<img width="1777" height="1268" alt="image" src="https://github.com/user-attachments/assets/c8700995-ac51-4783-9bae-350571cb0dea" />


