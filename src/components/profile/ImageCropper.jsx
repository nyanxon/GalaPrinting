import { useState, useCallback, useContext } from 'react';
import Cropper from 'react-easy-crop';
import { AuthContext } from '../context/AuthContext.jsx';
import { uploadAvatar } from '../../services/profileService.js';
import { showToast } from '../../core/toastEmitter.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = url;
  });
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '24px',
  width: '90%',
  maxWidth: '480px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
};

const cropContainerStyle = {
  position: 'relative',
  width: '100%',
  height: '300px',
  background: '#333',
  borderRadius: '8px',
  overflow: 'hidden',
};

const buttonRowStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
};

const cancelBtnStyle = {
  padding: '10px 20px',
  borderRadius: '8px',
  border: '1px solid #ccc',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
  color: '#6b6b6b',
};

const confirmBtnStyle = {
  padding: '10px 24px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--brand-brown, #785E40)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '700',
};

const confirmBtnDisabledStyle = {
  ...confirmBtnStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
};

const errorStyle = {
  color: '#dc2626',
  fontSize: '13px',
  margin: 0,
};

const fileInputStyle = {
  display: 'none', // hidden — triggered by styled button
};

const zoomLabelStyle = {
  fontSize: '13px',
  color: '#6b7280',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ImageCropper — modal for selecting, cropping, and uploading a profile avatar.
 *
 * Props:
 *   isOpen {boolean}                    — show/hide the modal
 *   onClose {() => void}                — called when modal is closed/cancelled
 *   onAvatarUpdated {(profile) => void} — called after successful upload
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */
export default function ImageCropper({ isOpen, onClose, onAvatarUpdated }) {
  const { updateUser } = useContext(AuthContext);

  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  function handleClose() {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFileError('');
    setUploadError('');
    setUploading(false);
    onClose();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');
    setUploadError('');
    setImageSrc(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('Ukuran file maksimal 5 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  }

  const onCropComplete = useCallback((_croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    setUploadError('');

    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.jpg');

      const updatedProfile = await uploadAvatar(formData);

      updateUser(updatedProfile);
      onAvatarUpdated(updatedProfile);
      showToast('Foto profil berhasil diperbarui.');
      handleClose();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal mengunggah foto profil.';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ganti foto profil"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
          Ganti Foto Profil
        </h2>

        {/* File input — styled as brand button */}
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
            Pilih gambar
          </p>
          <label
            htmlFor="avatar-file-input"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'var(--brand-brown, #785E40)',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'filter 0.15s',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.9)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
          >
            📁 Pilih File
          </label>
          <input
            id="avatar-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            style={fileInputStyle}
          />
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9b9b9b' }}>
            JPEG, PNG, WebP, atau GIF · Maks. 5 MB
          </p>
        </div>

        {fileError && <p style={errorStyle}>{fileError}</p>}

        {/* Crop area */}
        {imageSrc && (
          <>
            <div style={cropContainerStyle}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <label style={zoomLabelStyle}>
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ width: '100%' }}
                aria-label="Zoom"
              />
            </label>
          </>
        )}

        {uploadError && <p style={errorStyle}>{uploadError}</p>}

        {/* Action buttons */}
        <div style={buttonRowStyle}>
          <button
            type="button"
            style={cancelBtnStyle}
            onClick={handleClose}
            disabled={uploading}
          >
            Batal
          </button>
          <button
            type="button"
            style={uploading || !imageSrc ? confirmBtnDisabledStyle : confirmBtnStyle}
            onClick={handleConfirm}
            disabled={uploading || !imageSrc}
          >
            {uploading ? 'Mengunggah…' : 'Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  );
}
