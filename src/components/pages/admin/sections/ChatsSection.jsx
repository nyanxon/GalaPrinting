/**
 * ChatsSection.jsx — WhatsApp-style chat panel using chatService.js
 * Equivalent to vanilla admin/sections/chatsSection.js
 *
 * Requirements: 9.2, 9.4, 16.4
 */

import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../../../context/AuthContext.jsx';
import {
  getAllConversations,
  getMessagesByConversation,
  sendMessage,
  markAsRead,
  hideConversation,
  searchCustomers,
  createOrGetConversation,
} from '../../../../services/chatService.js';
import EmojiPickerButton from '../../../shared/EmojiPickerButton.jsx';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageBubble({ msg }) {
  const side = msg.senderRole === 'customer' ? 'customer' : 'admin';

  if (msg.type === 'file') {
    const isImage =
      msg.mimeType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].some((e) =>
        msg.fileName?.toLowerCase().endsWith(`.${e}`)
      );

    return (
      <div className={`chat-msg chat-msg--${side}`}>
        <div className="chat-bubble chat-bubble--file">
          <span>📎</span>
          <span>{msg.fileName || 'file'}</span>
          {msg.fileSize && (
            <span className="chat-file-size">{formatFileSize(msg.fileSize)}</span>
          )}
          {(msg.dataUrl || msg.filePath) && (
            <div className="chat-file-actions">
              {isImage && (
                <a
                  href={msg.dataUrl || msg.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chat-file-view-btn"
                >
                  🔍 Lihat
                </a>
              )}
              <a
                className="chat-file-dl-btn"
                href={msg.dataUrl || msg.filePath}
                download={msg.fileName || 'file'}
              >
                ⬇️ Download
              </a>
            </div>
          )}
        </div>
        <div className="chat-msg-time">{formatTime(msg.createdAt)}</div>
      </div>
    );
  }

  return (
    <div className={`chat-msg chat-msg--${side}`}>
      <div className="chat-bubble">{msg.content}</div>
      <div className="chat-msg-time">{formatTime(msg.createdAt)}</div>
    </div>
  );
}

export default function ChatsSection() {
  const { user } = useContext(AuthContext);

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [sendError, setSendError] = useState('');

  // New chat panel state (Req 7.1, 7.2)
  const [showNewChatPanel, setShowNewChatPanel] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatInputRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      let convs = await getAllConversations();
      convs = Array.isArray(convs) ? convs : [];
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        convs = convs.filter((c) =>
          (c.customerName || '').toLowerCase().includes(q)
        );
      }
      setConversations(convs);

      // Auto-select first conversation if none selected
      setActiveConvId((prev) => {
        if (!prev && convs.length > 0) return convs[0].id;
        // Keep current if still visible
        if (prev && convs.some((c) => c.id === prev)) return prev;
        // Fallback to first
        return convs.length > 0 ? convs[0].id : null;
      });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [searchQuery]);

  const loadMessages = useCallback(async () => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    try {
      const msgs = await getMessagesByConversation(activeConvId);
      setMessages(Array.isArray(msgs) ? msgs : []);
      // Mark as read for all staff roles (Req 1.3, 7.7)
      if (user?.role) {
        markAsRead(activeConvId, user.role);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [activeConvId, user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time sync
  useEffect(() => {
    function handleChatUpdate() {
      loadConversations();
      loadMessages();
    }
    function handleStorage(e) {
      if (e.key === 'gala.chats') {
        loadConversations();
        loadMessages();
      }
    }
    // Real-time: Socket.io message:new event (backend mode)
    function handleNewMessage() {
      loadConversations();
      loadMessages();
    }
    window.addEventListener('gala:chat-updated', handleChatUpdate);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('gala:message-new', handleNewMessage);
    return () => {
      window.removeEventListener('gala:chat-updated', handleChatUpdate);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gala:message-new', handleNewMessage);
    };
  }, [loadConversations, loadMessages]);

  // Debounced customer search (Req 7.3)
  useEffect(() => {
    if (customerSearchQuery.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const results = await searchCustomers(customerSearchQuery);
        setCustomerSearchResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Customer search failed:', err);
        setCustomerSearchResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchQuery]);

  // On customer selection: create/get conversation and open it (Req 7.4)
  async function handleCustomerSelect(customer) {
    try {
      const conv = await createOrGetConversation(customer.id, customer.name);
      if (conv) {
        setShowNewChatPanel(false);
        setCustomerSearchQuery('');
        setCustomerSearchResults([]);
        await loadConversations();
        setActiveConvId(conv.id);
      }
    } catch (err) {
      console.error('Failed to create/get conversation:', err);
    }
  }

  function handleConvSelect(convId) {
    setActiveConvId(convId);
    setPendingFile(null);
    setSendError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED = new Set(['pdf', 'png', 'jpg', 'jpeg', 'zip']);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED.has(ext)) {
      setSendError('Format tidak didukung. Gunakan PDF, PNG, JPG, JPEG, atau ZIP.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSendError('Ukuran file maksimal 5 MB.');
      e.target.value = '';
      return;
    }
    setSendError('');
    setPendingFile(file);
  }

  function handleRemoveFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSend() {
    if (!activeConvId) return;
    setSendError('');

    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;

    if (pendingFile) {
      const res = await sendMessage({
        customerId: conv.customerId,
        customerName: conv.customerName,
        senderId: user?.id || 'admin',
        senderRole: user?.role || 'admin',
        type: 'file',
        content: pendingFile.name,
        file: pendingFile,
      });
      if (!res.ok) {
        setSendError(res.message || 'Gagal mengirim file.');
        return;
      }
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadMessages();
      loadConversations();
      return;
    }

    const text = inputText.trim();
    if (!text) return;

    const res = await sendMessage({
      customerId: conv.customerId,
      customerName: conv.customerName,
      senderId: user?.id || 'admin',
      senderRole: user?.role || 'admin',
      type: 'text',
      content: text,
    });

    if (!res.ok) {
      setSendError(res.message || 'Gagal mengirim pesan.');
      return;
    }

    setInputText('');
    loadMessages();
    loadConversations();
  }

  async function handleHideConversation() {
    if (!activeConvId) return;
    const confirmed = window.confirm(
      'Tutup percakapan ini?\n\nPercakapan akan dihapus dari daftar chat, tetapi seluruh riwayat pesan tetap tersimpan. Kamu bisa membukanya kembali kapan saja dengan mencari nama atau nomor telepon customer.'
    );
    if (!confirmed) return;

    const res = await hideConversation(activeConvId);
    if (res.ok) {
      setActiveConvId(null);
      setMessages([]);
      await loadConversations();
    } else {
      setSendError(res.message || 'Gagal menutup percakapan.');
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const activeConv = activeConvId ? conversations.find((c) => c.id === activeConvId) ?? null : null;

  return (
    <div className="adm-card adm-card--chat">
      <div className="chat-layout">
        {/* Conversation list sidebar */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span>Percakapan ({conversations.length})</span>
              {/* Mulai Chat Baru button — visible to all staff roles (Req 7.1) */}
              <button
                type="button"
                onClick={() => {
                  setShowNewChatPanel((prev) => !prev);
                  setCustomerSearchQuery('');
                  setCustomerSearchResults([]);
                }}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                title="Mulai percakapan baru dengan customer"
              >
                + Mulai Chat Baru
              </button>
            </div>

            {/* Customer search panel (Req 7.2, 7.3, 7.5) */}
            {showNewChatPanel && (
              <div style={{ marginTop: '10px' }}>
                <input
                  className="adm-input"
                  type="search"
                  placeholder="Cari customer (nama / telepon)…"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  style={{ fontSize: '13px', padding: '6px 10px', width: '100%' }}
                  aria-label="Cari customer untuk memulai chat"
                  autoFocus
                />
                {customerSearchLoading && (
                  <div style={{ fontSize: '12px', color: '#6b7280', padding: '6px 0' }}>Mencari…</div>
                )}
                {!customerSearchLoading && customerSearchQuery.length >= 2 && (
                  <div style={{ marginTop: '4px', border: '1px solid #e5e7eb', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto', background: '#fff' }}>
                    {customerSearchResults.length === 0 ? (
                      <div style={{ padding: '10px', fontSize: '13px', color: '#6b7280' }}>
                        Tidak ada customer ditemukan.
                      </div>
                    ) : (
                      customerSearchResults.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => handleCustomerSelect(customer)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCustomerSelect(customer); }}
                          style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f4ff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                        >
                          <div style={{ fontWeight: 500 }}>{customer.name}</div>
                          {customer.phone && (
                            <div style={{ color: '#6b7280', fontSize: '12px' }}>{customer.phone}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <input
              className="adm-input"
              type="search"
              placeholder="Cari customer…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.trim())}
              style={{ marginTop: '10px', fontSize: '13px', padding: '6px 10px', width: '100%' }}
              aria-label="Cari percakapan"
            />
            <div style={{ marginTop: '5px', fontSize: '11px', color: '#9ca3af', lineHeight: 1.4 }}>
              Chat yang ditutup dapat dibuka kembali lewat "+ Mulai Chat Baru".
            </div>
          </div>
          <div className="chat-conv-list">
            {conversations.length === 0 ? (
              <div className="chat-empty">Belum ada percakapan.</div>
            ) : (
              conversations.map((c) => {
                const last = c.lastMessage;
                const preview = last
                  ? last.type === 'file'
                    ? `📎 ${last.fileName || 'file'}`
                    : last.content.slice(0, 40) + (last.content.length > 40 ? '…' : '')
                  : 'Belum ada pesan';

                return (
                  <div
                    key={c.id}
                    className={`chat-conv-item${c.id === activeConvId ? ' active' : ''}`}
                    onClick={() => handleConvSelect(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleConvSelect(c.id); }}
                  >
                    <div className="chat-conv-avatar">
                      {(c.customerName || '?')[0].toUpperCase()}
                    </div>
                    <div className="chat-conv-info">
                      <div className="chat-conv-name">{c.customerName}</div>
                      <div className="chat-conv-preview">{preview}</div>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="chat-unread-badge">{c.unreadCount}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="chat-main">
          {activeConv ? (
            <>
              <div className="chat-main-header">
                <div className="chat-conv-avatar">
                  {(activeConv.customerName || '?')[0].toUpperCase()}
                </div>
                <div className="chat-main-name">{activeConv.customerName}</div>
                {/* Ditangani = pesan terakhir dari admin/staff (assigned_admin_id ter-set)
                    Belum Ditangani = pesan terakhir dari customer (assigned_admin_id NULL) */}
                {activeConv.assignedAdminId ? (
                  <span className="chat-assigned">Ditangani</span>
                ) : (
                  <span className="chat-unassigned">Belum Ditangani</span>
                )}
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    className="chat-close-btn"
                    onClick={handleHideConversation}
                    title="Tutup percakapan — riwayat tetap tersimpan, bisa dibuka kembali lewat pencarian"
                    style={{ marginLeft: 'auto', background: '#374151', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Tutup Chat
                  </button>
                )}
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-no-msg">Belum ada pesan.</div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-row">
                <input
                  ref={chatInputRef}
                  className="chat-input"
                  type="text"
                  placeholder="Balas pesan…"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  autoComplete="off"
                  maxLength={1000}
                />
                <EmojiPickerButton
                  onEmojiSelect={(emoji) => setInputText((prev) => prev + emoji)}
                  inputRef={chatInputRef}
                />
                <label
                  className="chat-file-label"
                  htmlFor="chat-file-input"
                  title="Kirim file"
                  style={{ cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center' }}
                >
                  📎
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="chat-file-input"
                  className="cw-file-hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.zip"
                  aria-label="Upload file"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  className="chat-send-btn"
                  type="button"
                  onClick={handleSend}
                >
                  Kirim
                </button>
              </div>

              {pendingFile && (
                <div
                  className="chat-file-preview"
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', gap: '8px', borderTop: '1px solid #f0f0f0' }}
                >
                  <span>📎 {pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}
                    aria-label="Hapus file"
                  >
                    ✕
                  </button>
                </div>
              )}

              {sendError && (
                <div
                  className="chat-send-error"
                  role="alert"
                  style={{ padding: '8px 20px', color: '#b91c1c', fontSize: '13px' }}
                >
                  {sendError}
                </div>
              )}
            </>
          ) : (
            <div className="chat-no-conv">Pilih percakapan untuk memulai.</div>
          )}
        </div>
      </div>
    </div>
  );
}
