export interface ImmichAsset {
  id: string
  deviceAssetId: string
  ownerId: string
  deviceId: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER'
  originalPath: string
  originalFileName: string
  originalMimeType?: string
  thumbhash?: string
  fileCreatedAt: string
  fileModifiedAt: string
  localDateTime: string
  updatedAt: string
  isFavorite: boolean
  isArchived: boolean
  isTrashed: boolean
  isOffline: boolean
  hasMetadata: boolean
  duration?: string | number | null
  exifInfo?: {
    city?: string
    country?: string
    dateTimeOriginal?: string
    description?: string
    exifImageHeight?: number
    exifImageWidth?: number
    make?: string
    model?: string
  }
}

export interface ImmichConfig {
  serverUrl: string
  apiKey: string
  userName?: string
  // 'env' = logged in via a VITE_USER_* entry, 'manual' = login form
  source?: 'env' | 'manual'
}

export interface DeleteAssetsRequest {
  ids: string[]
  force?: boolean
}

export interface DeleteAssetsResponse {
  count: number
}

export interface EnvUser {
  name: string
  apiKey: string
}

export interface EnvConfig {
  serverUrl: string
  users: EnvUser[]
}

export interface ImmichAlbum {
  id: string
  albumName: string
  assetCount?: number
  createdAt?: string
  updatedAt?: string
  albumThumbnailAssetId?: string
}

export interface AddAssetsToAlbumRequest {
  ids: string[]
}

export type AssetVisibility = 'archive' | 'timeline' | 'hidden' | 'locked'

// POST /search/random (replaces GET /assets/random, which Immich v3 removed)
export interface RandomSearchRequest {
  size?: number
  type?: 'IMAGE' | 'VIDEO'
  visibility?: AssetVisibility
}

// POST /search/metadata (only the fields this app uses)
export interface MetadataSearchRequest {
  page?: number
  size?: number
  order?: 'asc' | 'desc'
  visibility?: AssetVisibility
}

export interface MetadataSearchResponse {
  assets?: {
    total?: number
    count?: number
    items?: ImmichAsset[]
    nextPage?: string | null
  }
}
