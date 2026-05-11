import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#C9B8FF" />
        <meta name="description" content="Your personal AI health companion" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <title>Vitalia</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
