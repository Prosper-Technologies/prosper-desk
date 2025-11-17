import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { randomBytes } from "crypto"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateAccessToken(): string {
  return randomBytes(32).toString('hex')
}

export function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  return formatDate(d)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getPriorityColor(priority: 'low' | 'medium' | 'high' | 'urgent'): string {
  switch (priority) {
    case 'low':
      return 'text-green-600 bg-green-50'
    case 'medium':
      return 'text-yellow-600 bg-yellow-50'
    case 'high':
      return 'text-orange-600 bg-orange-50'
    case 'urgent':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function getStatusColor(status: 'open' | 'in_progress' | 'resolved' | 'closed'): string {
  switch (status) {
    case 'open':
      return 'text-blue-600 bg-blue-50'
    case 'in_progress':
      return 'text-yellow-600 bg-yellow-50'
    case 'resolved':
      return 'text-green-600 bg-green-50'
    case 'closed':
      return 'text-gray-600 bg-gray-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function parseTextForLinks(text: string): { type: 'text' | 'link'; content: string }[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part) => {
    if (part.match(urlRegex)) {
      return { type: 'link' as const, content: part };
    }
    return { type: 'text' as const, content: part };
  });
}