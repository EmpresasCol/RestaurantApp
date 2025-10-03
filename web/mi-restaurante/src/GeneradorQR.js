import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download, QrCode } from 'lucide-react';

function GeneradorQR() {
  const baseURL = window.location.origin + window.location.pathname;
  const mesas = Array.from({ length: 12 }, (_, i) => i + 1);
  const [diseñoSeleccionado, setDiseñoSeleccionado] = useState('premium');

  const imprimirTodo = () => {
    window.print();
  };

  const descargarQR = (mesa) => {
    const contenedor = document.getElementById(`qr-card-${mesa}`);
    
    import('html2canvas').then((html2canvas) => {
      html2canvas.default(contenedor, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `restaurante-delice-mesa-${mesa}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    });
  };

  const descargarTodos = async () => {
    const html2canvas = await import('html2canvas');
    
    for (let mesa of mesas) {
      const contenedor = document.getElementById(`qr-card-${mesa}`);
      const canvas = await html2canvas.default(contenedor, {
        scale: 3,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `mesa-${mesa}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const abrirEnNavegador = (mesa) => {
    const url = `${baseURL}?mesa=${mesa}`;
    window.open(url, '_blank');
  };

  const renderQRPremium = (mesa) => {
    const url = `${baseURL}?mesa=${mesa}`;
    
    return (
      <div 
        id={`qr-card-${mesa}`}
        className="bg-gradient-to-br from-orange-50 to-white rounded-2xl shadow-2xl p-8 border-4 border-orange-500 page-break"
        style={{ width: '400px', height: '550px' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
            <span className="text-4xl">🍽️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Restaurante Délice
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-orange-400 to-orange-600 mx-auto rounded-full mb-3"></div>
          <p className="text-gray-600 text-sm">Escanea y ordena desde tu mesa</p>
        </div>

        {/* Mesa Badge */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-4 mb-6 shadow-lg">
          <div className="text-center">
            <p className="text-sm font-medium mb-1">MESA NÚMERO</p>
            <p className="text-5xl font-bold">{mesa}</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-lg border-4 border-orange-200">
            <QRCodeSVG
              id={`qr-mesa-${mesa}`}
              value={url}
              size={180}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23f97316'/%3E%3Ctext x='50' y='65' font-size='50' text-anchor='middle' fill='white'%3E🍽️%3C/text%3E%3C/svg%3E",
                height: 35,
                width: 35,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-orange-600">
            <QrCode size={20} />
            <p className="text-sm font-semibold">Apunta tu cámara aquí</p>
          </div>
          <p className="text-xs text-gray-500">
            📱 Menú digital • 🍔 Pide sin esperar • 💳 Paga fácil
          </p>
        </div>
      </div>
    );
  };

  const renderQRMinimalista = (mesa) => {
    const url = `${baseURL}?mesa=${mesa}`;
    
    return (
      <div 
        id={`qr-card-${mesa}`}
        className="bg-white rounded-xl shadow-xl p-8 border border-gray-200 page-break"
        style={{ width: '350px', height: '500px' }}
      >
        <div className="h-full flex flex-col justify-between">
          {/* Header minimalista */}
          <div className="text-center">
            <h1 className="text-2xl font-light text-gray-800 mb-1">
              Délice
            </h1>
            <div className="w-16 h-px bg-gray-300 mx-auto mb-4"></div>
            <div className="inline-block bg-black text-white px-6 py-2 rounded-full">
              <span className="text-3xl font-bold">Mesa {mesa}</span>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-gray-50 p-5 rounded-xl">
              <QRCodeSVG
                id={`qr-mesa-${mesa}`}
                value={url}
                size={180}
                level="H"
                fgColor="#000000"
                bgColor="#f9fafb"
              />
            </div>
          </div>

          {/* Footer minimalista */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Escanea para ordenar</p>
            <p className="text-xs text-gray-400">Menu digital • Sin contacto</p>
          </div>
        </div>
      </div>
    );
  };

  const renderQRPorDiseño = (mesa) => {
    switch (diseñoSeleccionado) {
      case 'premium':
        return renderQRPremium(mesa);
      case 'minimalista':
        return renderQRMinimalista(mesa);
      default:
        return renderQRPremium(mesa);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header de control */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 no-print">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🎨 Generador de QR Premium
              </h1>
              <p className="text-gray-600">
                Códigos QR profesionales para cada mesa
              </p>
            </div>
            <button
              onClick={imprimirTodo}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer size={20} />
              Imprimir Todos
            </button>
          </div>

          {/* Selector de diseño */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Estilo de diseño:</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setDiseñoSeleccionado('premium')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  diseñoSeleccionado === 'premium'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-4xl mb-2">✨</div>
                <p className="font-semibold text-gray-800">Premium</p>
                <p className="text-xs text-gray-600">Colorido y elegante</p>
              </button>

              <button
                onClick={() => setDiseñoSeleccionado('minimalista')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  diseñoSeleccionado === 'minimalista'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-4xl mb-2">⚪</div>
                <p className="font-semibold text-gray-800">Minimalista</p>
                <p className="text-xs text-gray-600">Simple y limpio</p>
              </button>
            </div>
          </div>
        </div>

        {/* Grid de QR codes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
          {mesas.map(mesa => (
            <div key={mesa} className="relative">
              {renderQRPorDiseño(mesa)}
              
              {/* Botones de acción */}
              <div className="absolute top-4 right-4 flex gap-2 no-print">
                <button
                  onClick={() => abrirEnNavegador(mesa)}
                  className="bg-blue-600 text-white p-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
                  title="Abrir en navegador"
                >
                  🔗
                </button>
                <button
                  onClick={() => descargarQR(mesa)}
                  className="bg-green-600 text-white p-2 rounded-lg shadow-lg hover:bg-green-700 transition-colors"
                  title="Descargar esta mesa"
                >
                  <Download size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estilos para impresión */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          .page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          body {
            margin: 0;
            padding: 0;
          }

          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}

export default GeneradorQR;