import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import './style.module.css';

export function QrCodeScanner() {
  const navigate = useNavigate();
  const [result, setResult] = useState('');
  const scannerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!scannerRef.current) return;

    const qrCodeScanner = new Html5QrcodeScanner(
      scannerRef.current.id,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      false
    );

    const onScanSuccess = (decodedText: string) => {
        console.log('Código QR escaneado:', decodedText);
        setResult(decodedText);
        qrCodeScanner.clear().catch(error => console.error(error));
    };

    const onScanError = (errorMessage: string) => {
      console.error('Erro ao escanear:', errorMessage);
    };

    qrCodeScanner.render(onScanSuccess, onScanError);

    return () => {
      // Limpar o scanner quando o componente for desmontado
      qrCodeScanner.clear().catch(error => console.error(error));
    };
  }, []);

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <div className="scanner-page">
      <header className="scanner-header">
        <button onClick={handleGoBack} className="back-button">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="24px"
            height="24px"
          >
            <path d="M0 0h24v24H0z" fill="none" />
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <h2>Digitalizar código QR</h2>
      </header>
      <div className="scanner-container">
        <div id="reader" ref={scannerRef}></div>
      </div>
      <div className="scanner-footer">
        <p>O provedor de conta exibirá um código QR</p>
        <button className="manual-input-button">Inserir o código manualmente</button>
        {result && <div className="scan-result">Resultado: {result}</div>}
      </div>
    </div>
  );
}
