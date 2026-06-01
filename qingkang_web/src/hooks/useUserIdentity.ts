import { useState } from 'react'
import { loginUser } from '../lib/api'
import type { User } from '../types/index'

export const STORAGE_USER = 'qingkang_user'
export const STORAGE_NICKNAME = 'qingkang_nickname'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function useUserIdentity() {
  const [nickname, setNickname] = useState(localStorage.getItem(STORAGE_NICKNAME) || '')
  const [user, setUser] = useState<User | null>(() => readStoredUser())
  const [busy, setBusy] = useState('')

  async function createIdentity(targetNickname = nickname) {
    const cleanNickname = targetNickname.trim()
    if (!cleanNickname) throw new Error('请输入昵称或学号')

    setBusy('start')
    try {
      const response = await loginUser(cleanNickname)
      setUser(response.user)
      localStorage.setItem(STORAGE_USER, JSON.stringify(response.user))
      localStorage.setItem(STORAGE_NICKNAME, response.user.nickname)
      setNickname(response.user.nickname)
      return response.user
    } finally {
      setBusy('')
    }
  }

  function clearIdentity() {
    setUser(null)
    setNickname('')
    localStorage.removeItem(STORAGE_USER)
    localStorage.removeItem(STORAGE_NICKNAME)
  }

  return {
    busy,
    nickname,
    setNickname,
    setUser,
    user,
    clearIdentity,
    createIdentity,
  }
}
