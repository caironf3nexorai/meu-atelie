import { createClient } from '../supabase/client';

export interface Client {
    id: string;
    user_id: string;
    name: string;
    whatsapp: string | null;
    city: string | null;
    birthday: string | null;
    notes: string | null;
    created_at: string;
    cpf?: string;
    email?: string;
    endereco_rua?: string;
    endereco_numero?: string;
    endereco_bairro?: string;
    endereco_cidade?: string;
    endereco_estado?: string;
    endereco_cep?: string;
}

export interface InventoryItem {
    id: string;
    user_id: string;
    name: string;
    category: 'Linha' | 'Tecido' | 'Bastidor' | 'Agulha' | 'Outros';
    quantity: number;
    min_quantity: number;
    unit_cost: number;
    unit: string;
    created_at?: string;
    updated_at?: string;
}

export interface InventoryMovement {
    id: string;
    inventory_item_id: string;
    order_id?: string | null;
    movement_type: 'entrada' | 'saida';
    quantity: number;
    unit_cost?: number;
    total_cost?: number;
    notes?: string;
    created_at?: string;
    // joined fields
    inventory_items?: InventoryItem;
    orders?: { clients?: { name: string } };
}

export interface Order {
    id: string;
    user_id: string;
    client_id: string;
    description: string;
    start_date: string | null;
    delivery_date: string;
    value: number;
    status: 'em_andamento' | 'finalizado' | 'entregue';
    notes: string | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
    codigo_rastreio?: string;
    rastreio_enviado_em?: string;
    orcamento_id?: string;
    clients?: Client; // Join
}

export interface OrderMaterial {
    id: string;
    order_id: string;
    inventory_item_id: string | null;
    item_name: string;
    quantity: number;
    unit_cost: number;
    total_cost: number;
    created_at: string;
}

export interface TimeSession {
    id: string;
    user_id: string;
    order_id: string | null;
    activity_description: string;
    started_at: string;
    stopped_at: string | null;
    duration_minutes: number | null;
    created_at: string;
    orders?: { description: string, clients?: { name: string } };
}

export const gestaoApi = {
    // ---- CLIENTES ----
    async getClients() {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const { data, error } = await supabase
            .from('clients')
            .select(`
                *,
                orders (
                    id, value, status, delivery_date, description
                )
            `)
            .eq('user_id', user.id)
            .order('name');

        if (error) throw error;
        return data as any[];
    },
    async createClient(client: Omit<Client, 'id' | 'user_id' | 'created_at'>) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const payload: any = { ...client, user_id: user.id };
        // Converter strings vazias para null para evitar erros de casting no Supabase (ex: data inválida)
        Object.keys(payload).forEach(key => {
            if (payload[key] === '') {
                payload[key] = null;
            }
        });

        const { data, error } = await supabase.from('clients').insert(payload).select().single();
        if (error) throw error;
        return data as Client;
    },
    async updateClient(id: string, clientData: Partial<Client>) {
        const supabase = createClient();
        const payload: any = { ...clientData };
        Object.keys(payload).forEach(key => {
            if (payload[key] === '') {
                payload[key] = null;
            }
        });
        const { data, error } = await supabase.from('clients').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data as Client;
    },

    // ---- ESTOQUE ----
    async getInventory() {
        const supabase = createClient();
        const { data, error } = await supabase.from('inventory_items').select('*').order('name');
        if (error) throw error;
        return data as InventoryItem[];
    },
    async createInventoryItem(item: Omit<InventoryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const { data, error } = await supabase.from('inventory_items').insert({ ...item, user_id: user.id }).select().single();
        if (error) throw error;

        // Register initial movement
        if (item.quantity > 0) {
            await supabase.from('inventory_movements').insert({
                user_id: user.id,
                inventory_item_id: data.id,
                movement_type: 'entrada',
                quantity: item.quantity,
                unit_cost: item.unit_cost,
                total_cost: item.quantity * (item.unit_cost || 0),
                notes: 'Saldo inicial (Cadastro)'
            });
        }

        return data as InventoryItem;
    },
    async updateInventoryQuantity(id: string, delta: number) {
        const supabase = createClient();
        // Supabase RPC or select+update para subtrair
        const { data: item } = await supabase.from('inventory_items').select('quantity').eq('id', id).single();
        if (item) {
            const { error } = await supabase.from('inventory_items').update({ quantity: Number(item.quantity) + delta }).eq('id', id);
            if (error) throw error;
        }
    },
    async updateInventoryItem(id: string, item: Partial<InventoryItem>) {
        const supabase = createClient();
        const { data, error } = await supabase.from('inventory_items').update(item).eq('id', id).select().single();
        if (error) throw error;
        return data as InventoryItem;
    },
    async deleteInventoryItem(id: string) {
        const supabase = createClient();
        const { error } = await supabase.from('inventory_items').delete().eq('id', id);
        if (error) throw error;
    },
    async getInventoryMovements() {
        const supabase = createClient();
        const { data, error } = await supabase.from('inventory_movements')
            .select('*, inventory_items(name, unit_cost), orders(clients(name))')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as InventoryMovement[];
    },
    async addInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'created_at'>) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const { data, error } = await supabase.from('inventory_movements')
            .insert({ ...movement, user_id: user.id })
            .select().single();
        if (error) throw error;

        // Also update the inventory quantity
        const delta = movement.movement_type === 'entrada' ? movement.quantity : -movement.quantity;
        await this.updateInventoryQuantity(movement.inventory_item_id, delta);

        return data as InventoryMovement;
    },

    // ---- ENCOMENDAS (AGENDA) ----
    async getOrders() {
        const supabase = createClient();
        const { data, error } = await supabase.from('orders').select('*, clients(*), order_materials(*)').order('delivery_date');
        if (error) throw error;
        return data as (Order & { clients: Client, order_materials: OrderMaterial[] })[];
    },
    async getOrderMaterials(orderId: string) {
        const supabase = createClient();
        const { data, error } = await supabase.from('order_materials').select('*').eq('order_id', orderId);
        if (error) throw error;
        return data as OrderMaterial[];
    },
    async createOrder(order: Omit<Order, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'clients'>) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const { data, error } = await supabase.from('orders').insert({ ...order, user_id: user.id }).select().single();
        if (error) throw error;
        return data as Order;
    },
    async updateOrder(orderId: string, orderData: Partial<Omit<Order, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'clients'>>) {
        const supabase = createClient();
        const { data, error } = await supabase.from('orders').update(orderData).eq('id', orderId).select().single();
        if (error) throw error;
        return data as Order;
    },
    async updateOrderStatus(orderId: string, status: Order['status'], photo_url?: string) {
        const supabase = createClient();
        const payload: any = { status };
        if (photo_url) payload.photo_url = photo_url;
        const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
        if (error) throw error;
    },
    async deleteOrder(orderId: string) {
        const supabase = createClient();
        // Cuidado: Dependendo de suas chaves estrangeiras, `order_materials` com `ON DELETE CASCADE` apagam junto
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
    },
    async addOrderMaterial(material: Omit<OrderMaterial, 'id' | 'created_at' | 'total_cost'>) {
        const supabase = createClient();
        const payload = { ...material };
        const { data, error } = await supabase.from('order_materials').insert(payload).select().single();
        if (error) throw error;
        // Deduct from inventory and log movement
        if (material.inventory_item_id) {
            await this.addInventoryMovement({
                inventory_item_id: material.inventory_item_id,
                order_id: material.order_id,
                movement_type: 'saida',
                quantity: material.quantity,
                unit_cost: material.unit_cost,
                total_cost: material.quantity * material.unit_cost,
                notes: 'Baixa de material para produção'
            });
        }
        return data as OrderMaterial;
    },

    // ---- CRONÔMETRO DE HORAS ----
    async getTimeSessions() {
        const supabase = createClient();
        const { data, error } = await supabase.from('time_sessions')
            .select('*, orders(description, clients(name))')
            .order('started_at', { ascending: false });
        if (error) throw error;
        return data as TimeSession[];
    },
    async startTimeSession(session: { order_id?: string | null, activity_description: string }) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const { data, error } = await supabase.from('time_sessions')
            .insert({ ...session, user_id: user.id })
            .select().single();
        if (error) throw error;
        return data as TimeSession;
    },
    async stopTimeSession(id: string) {
        const supabase = createClient();
        const { data, error } = await supabase.from('time_sessions')
            .update({ stopped_at: new Date().toISOString() })
            .eq('id', id)
            .select().single();
        if (error) throw error;
        return data as TimeSession;
    },
    async deleteTimeSession(id: string) {
        const supabase = createClient();
        const { error } = await supabase.from('time_sessions').delete().eq('id', id);
        if (error) throw error;
    }
};
