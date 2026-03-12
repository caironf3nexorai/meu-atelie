import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function ResetarSenhaPage() {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const supabase = createClient();
  const { toast } = useToast();

  const handleResetar = async () => {
    if (novaSenha !== confirmaSenha) {
      toast({ title: 'Erro', description: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (novaSenha.length < 6) {
      toast({ title: 'Aviso', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });

    if (!error) {
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso!' });
      navigate('/dashboard');
    } else {
      toast({ title: 'Erro', description: 'Link expirado. Solicite um novo email de recuperação.', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F2E9DB', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px', border: '1px solid #E5D9CC', margin: 'auto' }}>
        <h2 style={{ fontFamily: 'Playfair Display', fontSize: '28px', color: '#1C1410', margin: '0 0 8px' }}>
          Nova senha
        </h2>
        <p style={{ color: '#7A6A5A', fontSize: '14px', margin: '0 0 28px' }}>
          Digite sua nova senha abaixo.
        </p>

        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#1A1A1A', marginBottom: '6px' }}>Nova senha</label>
        <input type="password" value={novaSenha}
          onChange={e => setNovaSenha(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5D9CC', marginBottom: '16px', fontFamily: 'Nunito', outline: 'none' }} />

        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#1A1A1A', marginBottom: '6px' }}>Confirmar senha</label>
        <input type="password" value={confirmaSenha}
          onChange={e => setConfirmaSenha(e.target.value)}
          placeholder="Repita a nova senha"
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5D9CC', marginBottom: '24px', fontFamily: 'Nunito', outline: 'none' }} />

        <button onClick={handleResetar} disabled={loading}
          style={{ width: '100%', padding: '14px', background: '#AC5148', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '16px', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </div>
    </div>
  );
}
