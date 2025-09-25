namespace RestaurantApp.Models
{
    public enum EstadoMesa
    {
        Disponible,
        Ocupada,
        EsperandoPago,
        Limpieza,
        Reservada,
        FueraDeServicio
    }

    public enum EstadoPedido
    {
        EnProceso,
        Listo,
        Pagado,
        Cancelado,
        Entregado
    }

    public enum EstadoItemPedido
    {
        Pendiente,
        EnPreparacion,
        Listo,
        Servido,
        Cancelado
    }

    public enum CategoriaProducto
    {
        Entrada,
        PlatoPrincipal,
        Postre,
        Bebida,
        Adicional,
        Especial
    }

    public enum TipoUsuario
    {
        Mesero,
        Cocinero,
        Cajero,
        Administrador,
        Gerente
    }

    public enum MetodoPago
    {
        Efectivo,
        Tarjeta,
        TransferenciaBancaria,
        QR,
        Credito,
        Otro
    }

    public enum TipoTurno
    {
        Mañana,
        Tarde,
        Noche,
        Completo
    }
}