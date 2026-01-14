import dynamic from 'next/dynamic'

const Nebula = dynamic(() => import('../Nebula'), {
  ssr: false,
  loading: () => <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/40 flex items-center justify-center"><div className="text-lg">Loading Nebula Editor...</div></div>
})

export default function Home() {
  return <Nebula />
}
