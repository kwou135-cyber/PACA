import html2canvas from 'html2canvas';

export async function exportToImage(elementId: string, filenamePrefix: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 3, // For higher DPI (approx 300 DPI if base is 96)
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0];
    link.download = `${filenamePrefix}_${date}.png`;
    link.href = url;
    link.click();
  } catch (err) {
    console.error('Failed to export image', err);
  }
}
