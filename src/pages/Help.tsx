/* "Ayuda": a short guide for the team, in plain Spanish. Edit the text here. */
import { href } from '../lib/router';
import type { TeamMember } from '../lib/types';

export default function Help({ me }: { me: TeamMember }) {
  return (
    <section className="stack help">
      <h1>Cómo usar el CRM</h1>

      <div className="card stack">
        <h2>1. De dónde vienen los leads</h2>
        <p>
          Cada vez que alguien rellena un formulario de la web, aparece aquí como lead nuevo. Se asigna solo a la
          persona de su departamento (por ejemplo, Tecnología → Tecnología). Las consultas generales y el formulario
          rápido llegan <strong>sin asignar</strong>: la dirección los reparte.
        </p>
        <p>
          El número junto a <a href={href.leads}>Leads</a> en el menú son los leads <strong>nuevos</strong> que
          {me.role === 'owner' ? ' hay en total' : ' tienes asignados'} y que nadie ha tocado todavía.
        </p>
      </div>

      <div className="card stack">
        <h2>2. Trabajar un lead</h2>
        <ul>
          <li>Abre el lead y contacta con los botones <strong>Email</strong>, <strong>Llamar</strong> o <strong>WhatsApp</strong>.</li>
          <li>
            Cambia la <strong>etapa</strong> según avance: Nuevo → Contactado → Cualificado → Reunión agendada →
            Propuesta enviada → Ganado. Si no sigue: <em>Perdido</em> o <em>Aún no está listo</em>, con el motivo.
          </li>
          <li>Apunta cada llamada o conversación en <strong>Notas</strong>. Así cualquiera puede seguir el caso.</li>
          <li>Si la persona reserva por Cal.com, la etapa y la fecha de la reunión se ponen solas.</li>
          <li>El <strong>Historial</strong> del lead muestra quién cambió qué y cuándo.</li>
        </ul>
      </div>

      <div className="card stack">
        <h2>3. Pipeline</h2>
        <p>
          En <a href={href.pipeline}>Pipeline</a> ves todos tus leads en columnas por etapa. Arrastra una tarjeta a
          otra columna para cambiar su etapa. En el móvil, abre el lead y cambia la etapa allí.
        </p>
      </div>

      <div className="card stack">
        <h2>4. Leads que no llegan por la web</h2>
        <p>
          Si alguien llama o viene a la oficina, créalo con <a href={href.leadNew}>+ Nuevo lead</a>. Marca la casilla de
          privacidad solo si la persona ha aceptado que guardemos sus datos.
        </p>
      </div>

      <div className="card stack">
        <h2>5. Campañas y códigos QR</h2>
        <p>
          Cada campaña tiene su QR o enlace. Los leads que entran por él quedan unidos a la campaña, y en{' '}
          <a href={href.campaigns}>Campañas</a> y <a href={href.analytics}>Analítica</a> se ve cuántos escaneos, leads y
          ventas trae cada una.
        </p>
      </div>

      <div className="card stack">
        <h2>6. Contraseña y acceso</h2>
        <p>
          Solo puedes ver los leads de tus departamentos y los que te asignan. Si olvidas la contraseña, usa
          "¿Has olvidado la contraseña?" en la pantalla de entrada, o pide a la dirección una contraseña temporal nueva.
        </p>
      </div>
    </section>
  );
}
