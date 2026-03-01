export type LicenseStatus = 'active' | 'expired' | 'unbound' | 'unknown'

export type LicenseData = {
  key: string
  hwid: string
  expireAt: number
  status: LicenseStatus
}

export type LicenseApiSuccessResponse = {
  success: true
  data: LicenseData
}

export type LicenseApiErrorResponse = {
  success: false
  error: string
}

export type LicenseApiResponse = LicenseApiSuccessResponse | LicenseApiErrorResponse

export type StoredLicense = {
  key: string
  hwid: string
  expireAt: number
  status: LicenseStatus
  lastCheckedAt: number
}
