/**
 * DMSection.jsx — Staff-to-staff direct messaging panel
 *
 * Mirrors ChatsSection.jsx structure with a left panel (DM conversation list)
 * and right panel (message thread).
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10,
 *               2.10, 2.11, 2.13, 9.3, 9.4
 */

import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../../../context/AuthContext.jsx';
import {
  getDMConversations,
  getMessagesByConversation,
  markAsRead,
  createOrGetDMConversation,
  searchStaff,
  validateFile,
} from '../../../../services/chatService.js';
import { api } from '../../../../core/httpClient.js';
import EmojiPickerButton from '../../../shared/EmojiPickerButton.jsx';

/* ── Helpers ─────────────────────────────────────────────── */

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Role badge colors (Req 8.2, 2.11) ──────────────────── */
const ROLE_BADGE_COLORS = {
  admin:       '#2563eb',
  owner:       '#2563eb',
  cs:          '#16a34a',
  cashier:     '#d97706',
  operational: '#7c3aed',
  qc:          '#0891b2',
  offline:     '#6b7280',
};

function getRoleBadgeColor(role) {
  return ROLE_BADGE_COLORS[role] ?? '#6b7280';
}

/* ── MessageBubble (reused from ChatsSection pattern) ────── */
function MessageBubble({ msg, currentUserId }) {
  // In DM, messages from the current user appear on the right (admin side)
  const side = msg.senderId === currentUserId ? 'admin' : 'customer';

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

/* ══════════════════════════════════════════════════════════
   DMSection Component
   ══════════════════════════════════════════════════════════ */

export default function DMSection() {
  const { user } = useContext(AuthContext);

  // DM conversation list state
  const [dmConversations, setDmConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);

  // Message input state
  const [inputText, setInputText] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [sendError, setSendError] = useState('');

  // "Pesan Baru" staff directory search panel state (Req 8.4, 8.5, 8.6)
  const [showNewDMPanel, setShowNewDMPanel] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffSearchResults, setStaffSearchResults] = useState([]);
  const [staffSearchLoading, setStaffSearchLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const dmInputRef = useRef(null);

  /* ── Load DM conversations (Req 8.1, 8.2) ─────────────── */
  const loadDMConversations = useCallback(async () => {
    try {
      const convs = await getDMConversations();
      // Sorted by last_at DESC — backend returns them sorted, but ensure it here too
      const sorted = Array.isArray(convs)
        ? [...convs].sort((a, b) => {
            const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
            const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
            return tb - ta;
          })
        : [];
      setDmConversations(sorted);

      // Auto-select first conversation if none selected
      setActiveConvId((prev) => {
        if (!prev && sorted.length > 0) return sorted[0].id;
        if (prev && sorted.some((c) => c.id === prev)) return prev;
        return sorted.length > 0 ? sorted[0].id : null;
      });
    } catch (err) {
      console.error('Failed to load DM conversations:', err);
    }
  }, []);

  /* ── Load messages for active DM conversation (Req 8.3) ── */
  const loadMessages = useCallback(async () => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    try {
      const msgs = await getMessagesByConversation(activeConvId);
      setMessages(Array.isArray(msgs) ? msgs : []);
      // Mark as read (Req 2.10)
      markAsRead(activeConvId, user?.role);
    } catch (err) {
      console.error('Failed to load DM messages:', err);
    }
  }, [activeConvId, user]);

  useEffect(() => {
    loadDMConversations();
  }, [loadDMConversations]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Real-time event listeners (Req 8.8, 8.9) ─────────── */
  useEffect(() => {
    // gala:message-new — refresh DM list and active thread (Req 8.8)
    function handleMessageNew() {
      loadDMConversations();
      loadMessages();
    }

    // gala:dm-new — add new DM conversation to list without full reload (Req 8.9)
    function handleDMNew() {
      loadDMConversations();
    }

    window.addEventListener('gala:message-new', handleMessageNew);
    window.addEventListener('gala:dm-new', handleDMNew);

    return () => {
      window.removeEventListener('gala:message-new', handleMessageNew);
      window.removeEventListener('gala:dm-new', handleDMNew);
    };
  }, [loadDMConversations, loadMessages]);

  /* ── Debounced staff directory search (Req 8.5, 2.13) ──── */
  useEffect(() => {
    if (staffSearchQuery.length < 2) {
      setStaffSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setStaffSearchLoading(true);
      try {
        const results = await searchStaff(staffSearchQuery);
        // Backend already excludes self via excludeUserId, but filter client-side too
        const filtered = Array.isArray(results)
          ? results.filter((s) => s.id !== user?.id)
          : [];
        setStaffSearchResults(filtered);
      } catch (err) {
        console.error('Staff search failed:', err);
        setStaffSearchResults([]);
      } finally {
        setStaffSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [staffSearchQuery, user]);

  /* ── On staff selection: create/get DM and open it (Req 8.6, 2.2) ── */
  async function handleStaffSelect(staff) {
    try {
      const conv = await createOrGetDMConversation(staff.id);
      if (conv) {
        setShowNewDMPanel(false);
        setStaffSearchQuery('');
        setStaffSearchResults([]);
        await loadDMConversations();
        setActiveConvId(conv.id);
      }
    } catch (err) {
      console.error('Failed to create/get DM conversation:', err);
    }
  }

  /* ── Conversation selection ──────────────────────────────── */
  function handleConvSelect(convId) {
    setActiveConvId(convId);
    setPendingFile(null);
    setSendError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /* ── File input handling (Req 8.7, 9.3, 9.4) ────────────── */
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.ok) {
      setSendError(validation.message);
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

  /* ── Send message (Req 8.7, 8.10) ───────────────────────── */
  async function handleSend() {
    if (!activeConvId) return;
    setSendError('');

    // File send
    if (pendingFile) {
      try {
        const formData = new FormData();
        formData.append('file', pendingFile);
        await api.post(`/api/conversations/${activeConvId}/messages/file`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadMessages();
        loadDMConversations();
      } catch (err) {
        const msg = err.response?.data?.message || 'Gagal mengirim file.';
        setSendError(msg);
      }
      return;
    }

    // Text send — inline validation (Req 8.10)
    const trimmed = inputText.trim();
    if (!trimmed) {
      setSendError('Pesan tidak boleh kosong.');
      return;
    }

    try {
      await api.post(`/api/conversations/${activeConvId}/messages`, { content: trimmed });
      setInputText('');
      loadMessages();
      loadDMConversations();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mengirim pesan.';
      setSendError(msg);
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const activeConv = activeConvId
    ? dmConversations.find((c) => c.id === activeConvId) ?? null
    : null;

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="adm-card adm-card--chat">
      <div className="chat-layout">
        {/* ── Left panel: DM conversation list ─────────────── */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span>Pesan Langsung ({dmConversations.length})</span>
              {/* "Pesan Baru" button (Req 8.4) */}
              <button
                type="button"
                onClick={() => {
                  setShowNewDMPanel((prev) => !prev);
                  setStaffSearchQuery('');
                  setStaffSearchResults([]);
                }}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                }}
                title="Mulai pesan langsung baru"
              >
                + Pesan Baru
              </button>
            </div>

            {/* Staff directory search panel (Req 8.5, 8.6, 2.13) */}
            {showNewDMPanel && (
              <div style={{ marginTop: '10px' }}>
                <input
                  className="adm-input"
                  type="search"
                  placeholder="Cari staff (nama)…"
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  style={{ fontSize: '13px', padding: '6px 10px', width: '100%' }}
                  aria-label="Cari staff untuk memulai pesan langsung"
                  autoFocus
                />
                {staffSearchLoading && (
                  <div style={{ fontSize: '12px', color: '#6b7280', padding: '6px 0' }}>
                    Mencari…
                  </div>
                )}
                {!staffSearchLoading && staffSearchQuery.length >= 2 && (
                  <div
                    style={{
                      marginTop: '4px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      background: '#fff',
                    }}
                  >
                    {staffSearchResults.length === 0 ? (
                      <div style={{ padding: '10px', fontSize: '13px', color: '#6b7280' }}>
                        Tidak ada staff ditemukan.
                      </div>
                    ) : (
                      staffSearchResults.map((staff) => (
                        <div
                          key={staff.id}
                          onClick={() => handleStaffSelect(staff)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleStaffSelect(staff);
                          }}
                          style={{
                            padding: '8px 10px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f0f4ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '';
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{staff.name}</div>
                          </div>
                          {staff.role && (
                            <span
                              style={{
                                background: getRoleBadgeColor(staff.role),
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'capitalize',
                              }}
                            >
                              {staff.role}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DM conversation list (Req 8.1, 8.2, 2.11) */}
          <div className="chat-conv-list">
            {dmConversations.length === 0 ? (
              <div className="chat-empty">Belum ada pesan langsung.</div>
            ) : (
              dmConversations.map((c) => {
                const last = c.lastMessage;
                const preview = last
                  ? last.type === 'file'
                    ? `📎 ${last.fileName || 'file'}`
                    : (last.content || '').slice(0, 40) +
                      ((last.content || '').length > 40 ? '…' : '')
                  : 'Belum ada pesan';

                const name = c.otherParticipantName || '?';
                const role = c.otherParticipantRole || '';

                return (
                  <div
                    key={c.id}
                    className={`chat-conv-item${c.id === activeConvId ? ' active' : ''}`}
                    onClick={() => handleConvSelect(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleConvSelect(c.id);
                    }}
                  >
                    <div className="chat-conv-avatar">{name[0].toUpperCase()}</div>
                    <div className="chat-conv-info">
                      <div
                        className="chat-conv-name"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>{name}</span>
                        {role && (
                          <span
                            style={{
                              background: getRoleBadgeColor(role),
                              color: '#fff',
                              borderRadius: '4px',
                              padding: '1px 5px',
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          >
                            {role}
                          </span>
                        )}
                      </div>
                      <div className="chat-conv-preview">{preview}</div>
                    </div>
                    {/* Unread count badge (Req 8.2) */}
                    {c.unreadCount > 0 && (
                      <span className="chat-unread-badge">{c.unreadCount}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right panel: message thread ───────────────────── */}
        <div className="chat-main">
          {activeConv ? (
            <>
              {/* Thread header */}
              <div className="chat-main-header">
                <div className="chat-conv-avatar">
                  {(activeConv.otherParticipantName || '?')[0].toUpperCase()}
                </div>
                <div className="chat-main-name">{activeConv.otherParticipantName}</div>
                {activeConv.otherParticipantRole && (
                  <span
                    style={{
                      background: getRoleBadgeColor(activeConv.otherParticipantRole),
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      marginLeft: '8px',
                    }}
                  >
                    {activeConv.otherParticipantRole}
                  </span>
                )}
              </div>

              {/* Messages (Req 8.3) — chronological order */}
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-no-msg">Belum ada pesan.</div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} currentUserId={user?.id} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input row (Req 8.7, 8.10) */}
              <div className="chat-input-row">
                <input
                  ref={dmInputRef}
                  className="chat-input"
                  type="text"
                  placeholder="Tulis pesan…"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  autoComplete="off"
                  maxLength={1000}
                />
                <EmojiPickerButton
                  onEmojiSelect={(emoji) => setInputText((prev) => prev + emoji)}
                  inputRef={dmInputRef}
                />
                <label
                  className="chat-file-label"
                  htmlFor="dm-file-input"
                  title="Kirim file"
                  style={{ cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center' }}
                >
                  📎
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="dm-file-input"
                  className="cw-file-hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.zip"
                  aria-label="Upload file"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <button className="chat-send-btn" type="button" onClick={handleSend}>
                  Kirim
                </button>
              </div>

              {/* Pending file preview */}
              {pendingFile && (
                <div
                  className="chat-file-preview"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 20px',
                    gap: '8px',
                    borderTop: '1px solid #f0f0f0',
                  }}
                >
                  <span>📎 {pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    style={{
                      marginLeft: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#b91c1c',
                    }}
                    aria-label="Hapus file"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Inline validation / send error (Req 8.10) */}
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
