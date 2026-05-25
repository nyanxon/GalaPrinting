import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase.js';

export default function SupabaseDemo() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data, error } = await supabase.from('todos').select();
        if (!mounted) return;
        if (error) {
          setError(error.message || 'Error fetching todos');
          setTodos([]);
        } else {
          setTodos(data || []);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || String(err));
        setTodos([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading Supabase data…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <div>
      <h2>Supabase Demo — `todos`</h2>
      {todos.length === 0 ? (
        <div>No todos found.</div>
      ) : (
        <ul>
          {todos.map((t) => (
            <li key={t.id}>{t.name ?? JSON.stringify(t)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
