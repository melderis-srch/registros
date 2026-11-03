import './globals.css';

export const metadata = {
  title: 'Surchérie · Registros',
  description: 'Cirugías, remitos, registros de consumo, órdenes de compra y recepciones',
  icons: { icon: '/logo.svg' },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#2F55B0' };

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
