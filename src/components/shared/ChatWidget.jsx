import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import {
  createOrGetConversation,
  getMessagesByCustomer,
  sendMessage,
  validateFile,
  getCustomerUnreadCount,
  markAdminMessagesReadForCustomer,
} from '../../services/chatService.js';
import { USE_BACKEND } from '../../core/httpClient.js';
import EmojiPickerButton from './EmojiPickerButton.jsx';

/**
 * Staff roles — widget is hidden for these users (they use the dashboard).
 */
const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

/**
 * Format an ISO timestamp to HH:MM (Indonesian locale).
 */
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format file size in human-readable form.
 */
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Single message bubble component.
 */
function MessageBubble({ msg }) {
  const side = msg.senderRole === 'customer' ? 'customer' : 'admin';

  if (msg.type === 'file') {
    const isImage =
      msg.mimeType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].some((ext) =>
        msg.fileName?.toLowerCase().endsWith(`.${ext}`)
      );

    return (
      <div className={`cw-msg cw-msg--${side}`}>
        <div className="cw-bubble cw-bubble--file">
          <span className="cw-file-icon">📎</span>
          <span className="cw-file-name">{msg.fileName || 'file'}</span>
          {msg.fileSize && (
            <span className="cw-file-size">{formatFileSize(msg.fileSize)}</span>
          )}
          {(msg.dataUrl || msg.filePath) && (
            <div className="cw-file-actions">
              {isImage && (
                <a
                  className="cw-file-view-btn"
                  href={msg.dataUrl || msg.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🔍 Lihat
                </a>
              )}
              <a
                className="cw-file-dl-btn"
                href={msg.dataUrl || msg.filePath}
                download={msg.fileName || 'file'}
              >
                ⬇️ Download
              </a>
            </div>
          )}
        </div>
        <div className="cw-msg-time">{formatTime(msg.createdAt)}</div>
      </div>
    );
  }

  return (
    <div className={`cw-msg cw-msg--${side}`}>
      <div className="cw-bubble">{msg.content}</div>
      <div className="cw-msg-time">{formatTime(msg.createdAt)}</div>
    </div>
  );
}

/**
 * ChatWidget component
 *
 * Floating chat widget — visible to guests and customers.
 * Hidden for staff roles (they use the dashboard).
 *
 * Behaviour by auth state:
 *   Guest (not logged in) → sees widget, sees login prompt, cannot send
 *   Customer (logged in)  → full chat, real-time sync
 *   Staff                 → widget hidden entirely
 *
 * Requirements: 6.3
 */
function ChatWidget() {
  const { user } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);
  const cwInputRef = useRef(null);

  const role = user?.role ?? null;
  const isStaff = role !== null && STAFF_ROLES.includes(role);
  const isCustomer = role === 'customer';

  // ── Unread count state ──────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  const pollTimerRef = useRef(null);
  const isOpenRef = useRef(false);

  // Keep isOpenRef in sync with isOpen so the polling callback always sees the latest value
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const refreshUnreadCount = useCallback(async () => {
    if (!isCustomer || !user) return;
    const count = await getCustomerUnreadCount(user.id);
    setUnreadCount(count);
  }, [isCustomer, user]);

  // Poll for unread count every 30s and on relevant socket events
  useEffect(() => {
    if (!isCustomer) return;

    refreshUnreadCount();

    pollTimerRef.current = setInterval(refreshUnreadCount, 30_000);

    function handleNewMessage() {
      // Only bump badge when widget is closed
      if (!isOpenRef.current) {
        refreshUnreadCount();
      }
    }

    window.addEventListener('gala:message-new', handleNewMessage);
    window.addEventListener('gala:chat-updated', refreshUnreadCount);

    return () => {
      clearInterval(pollTimerRef.current);
      window.removeEventListener('gala:message-new', handleNewMessage);
      window.removeEventListener('gala:chat-updated', refreshUnreadCount);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer, user]);

  // Clear badge when widget opens
  useEffect(() => {
    if (isOpen && isCustomer && user && unreadCount > 0) {
      setUnreadCount(0);
      markAdminMessagesReadForCustomer(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load messages when widget opens (customer only)
  const loadMessages = useCallback(async () => {
    if (!user) return;
    const msgs = await getMessagesByCustomer(user.id, user.name);
    setMessages(Array.isArray(msgs) ? msgs : []);
  }, [user]);

  // Pre-create conversation and load messages when customer opens widget
  useEffect(() => {
    if (isOpen && isCustomer && user) {
      createOrGetConversation(user.id, user.name).then((conv) => {
        // In backend mode, tell the socket server to join this conversation room.
        // The _handleJoinConversation handler in chatService queues the join if
        // the socket is not yet connected, so dispatch unconditionally.
        if (USE_BACKEND && conv?.id) {
          window.dispatchEvent(new CustomEvent('gala:join-conversation', { detail: { conversationId: conv.id } }));
        }
      }).catch(() => {});
      loadMessages();
    }
  }, [isOpen, isCustomer, user, loadMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen && isCustomer && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, isOpen, isCustomer]);

  // Real-time sync: same-tab and cross-tab events
  useEffect(() => {
    if (!isCustomer) return;

    function handleChatUpdated() {
      if (isOpen) loadMessages();
    }

    function handleStorage(e) {
      if (e.key === 'gala.chats' && isOpen) loadMessages();
    }

    // Listen for new messages in backend mode (Socket.io events)
    function handleNewMessage() {
      if (isOpen) loadMessages();
    }

    window.addEventListener('gala:chat-updated', handleChatUpdated);
    window.addEventListener('storage', handleStorage);
    if (USE_BACKEND) {
      window.addEventListener('gala:message-new', handleNewMessage);
    }
    return () => {
      window.removeEventListener('gala:chat-updated', handleChatUpdated);
      window.removeEventListener('storage', handleStorage);
      if (USE_BACKEND) {
        window.removeEventListener('gala:message-new', handleNewMessage);
      }
    };
  }, [isCustomer, isOpen, loadMessages]);

  // Hide widget entirely for staff
  if (isStaff) return null;

  function handleToggle() {
    setIsOpen((prev) => !prev);
  }

  function handleClose() {
    setIsOpen(false);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.ok) {
      setFileError(validation.message);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileError('');
    setPendingFile(file);
  }

  function handleRemoveFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSend() {
    if (!isCustomer || !user) return;
    setFileError('');

    if (pendingFile) {
      const res = await sendMessage({
        customerId: user.id,
        customerName: user.name,
        senderId: user.id,
        senderRole: 'customer',
        type: 'file',
        content: pendingFile.name,
        file: pendingFile,
      });
      if (!res.ok) {
        setFileError(res.message);
        return;
      }
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadMessages();
      return;
    }

    const text = inputText.trim();
    if (!text) return;

    const res = await sendMessage({
      customerId: user.id,
      customerName: user.name,
      senderId: user.id,
      senderRole: 'customer',
      type: 'text',
      content: text,
    });

    if (res.ok) {
      setInputText('');
      await loadMessages();
    } else {
      setFileError(res.message);
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const toggleIcon = isOpen ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
    </svg>
  );

  return (
    <div id="chat-widget-root">
      {/* Toggle button */}
      <button
        className="cw-toggle"
        id="cw-toggle"
        type="button"
        aria-label={isOpen ? 'Tutup chat' : `Buka chat${unreadCount > 0 ? `, ${unreadCount} pesan baru` : ''}`}
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        {toggleIcon}
        {!isOpen && unreadCount > 0 && (
          <span className="cw-unread-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat box */}
      {isOpen && (
        <div
          className="cw-box"
          role="dialog"
          aria-label="Customer Support Chat"
          aria-modal="false"
        >
          {/* Header */}
          <div className="cw-header">
            <div className="cw-header-info">
              <div className="cw-header-avatar">G</div>
              <div>
                <div className="cw-header-title">Customer Support</div>
                <div className="cw-header-sub">Gala Printing · Online</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="cw-body" id="cw-body" ref={bodyRef}>
            {!isCustomer ? (
              /* Guest: login prompt */
              <div className="cw-guest-prompt">
                <div className="cw-guest-icon">💬</div>
                <p className="cw-guest-title">Butuh bantuan?</p>
                <p className="cw-guest-sub">
                  Login atau daftar untuk mulai chat dengan tim kami.
                </p>
                <Link className="cw-login-btn" to="/register">
                  Login / Daftar
                </Link>
              </div>
            ) : messages.length === 0 ? (
              <div className="cw-empty">Belum ada pesan. Mulai percakapan! 👋</div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
            )}
          </div>

          {/* Input area */}
          {!isCustomer ? (
            /* Guest: disabled input */
            <div className="cw-input-area cw-input-area--disabled">
              <div className="cw-input-row">
                <input
                  className="cw-input"
                  type="text"
                  placeholder="Login untuk mulai chat…"
                  disabled
                  aria-disabled="true"
                />
                <button
                  className="cw-send"
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-label="Kirim"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            /* Customer: full input */
            <div className="cw-input-area">
              <div className="cw-input-row">
                <input
                  ref={cwInputRef}
                  className="cw-input"
                  id="cw-input"
                  type="text"
                  placeholder="Ketik pesan…"
                  autoComplete="off"
                  maxLength={1000}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                />
                <EmojiPickerButton
                  onEmojiSelect={(emoji) => setInputText((prev) => prev + emoji)}
                  inputRef={cwInputRef}
                />
                <label className="cw-file-btn" htmlFor="cw-file-input" title="Kirim file (PDF, PNG, JPG, ZIP)">
                  📎
                </label>
                <input
                  type="file"
                  id="cw-file-input"
                  className="cw-file-hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.zip"
                  aria-label="Upload file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <button
                  className="cw-send"
                  id="cw-send"
                  type="button"
                  aria-label="Kirim"
                  onClick={handleSend}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>
                </button>
              </div>

              {pendingFile && (
                <div className="cw-file-preview" style={{ display: 'flex' }}>
                  <span className="cw-preview-name">📎 {pendingFile.name}</span>
                  <button
                    className="cw-preview-remove"
                    type="button"
                    aria-label="Hapus file"
                    onClick={handleRemoveFile}
                  >
                    ✕
                  </button>
                </div>
              )}

              {fileError && (
                <div className="cw-error" style={{ display: 'block' }}>
                  {fileError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatWidget;
