import './globals.css'
import './motion.css'
import { AuthProvider } from '@/context/auth-context'
import PageTransition from '@/components/PageTransition'

export const metadata = {
  title: 'KEJETIA ONLINE — Find Anything in Kejetia Market',
  description: 'Connect with every shop in Kejetia Market, Kumasi. Search products, compare prices, find stores on the map.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <PageTransition>
            {children}
          </PageTransition>
        </AuthProvider>
      </body>
    </html>
  )
}
