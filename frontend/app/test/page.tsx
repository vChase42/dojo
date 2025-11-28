'use client'
import { useEffect, useState } from 'react'

export default function Test() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('http://localhost:3000/u/user1', { headers: { Accept: 'application/activity+json' } })
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
  }, [])

  return (
    <main className="p-4 text-white">
      <h1 className="text-xl font-bold mb-2">Backend Fetch Test</h1>
      <pre className="bg-gray-800 p-2 rounded">{JSON.stringify(data, null, 2)}</pre>
    </main>
  )
}
