export interface Cliente {
    id: number;
    name: string;
    service: string;
    time: string;
    status: "Agendado" | "Consultado" | "Cancelado";
    color: string;
    day: number;
}

export const clientes: Cliente[] = [
    { 
        id: 1, 
        name: "João Teste", 
        service: "Corte de cabelo",
        time: "12:00", 
        status: "Consultado", 
        color: "var(--theme-success)",
        day: 23
    },
    { 
        id: 2, 
        name: "Mc Poze", 
        service: "Corte do Jaca",
        time: "13:00", 
        status: "Agendado", 
        color: "var(--theme-warning)",
        day: 23
    },
    { 
        id: 3, 
        name: "Adolfo", 
        service: "Bigode",
        time: "14:00", 
        status: "Cancelado", 
        color: "var(--theme-error)",
        day: 25
    },
    { 
        id: 4, 
        name: "Mauro du Grau", 
        service: "Corte do Jaca",
        time: "15:00", 
        status: "Cancelado", 
        color: "var(--theme-error)",
        day: 25
    },
    { 
        id: 5, 
        name: "Teste Teste", 
        service: "Corte Americano",
        time: "16:00", 
        status: "Cancelado", 
        color: "var(--theme-error)",
        day: 25
    },
    { 
        id: 6, 
        name: "Teste Jota", 
        service: "Corte Disfarçado",
        time: "17:00", 
        status: "Cancelado", 
        color: "var(--theme-error)",
        day: 25
    },
]
