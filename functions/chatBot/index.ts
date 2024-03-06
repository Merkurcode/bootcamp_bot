import { corsHeaders } from '../_shared/cors.ts';
import { serve } from "https://deno.land/std@0.214.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supUrl = Deno.env.get("SUPABASE_URL") as string;
const supKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
const supabaseClient = createClient(supUrl, supKey);

function getTextUser(messages: any) {
  let result = { text: "", id: "" };
  const typeMessage = messages["type"];

  if (typeMessage == "text") {
    result.text = (messages["text"])["body"];
  } else if (typeMessage == "interactive") {
    const interactiveObject = messages["interactive"];
    const typeInteractive = interactiveObject["type"];

    if (typeInteractive == "button_reply") {
      result.text = (interactiveObject["button_reply"])["title"];
    } else if (typeInteractive == "list_reply") {
      const listReplyObject = interactiveObject["list_reply"];
      result.text = listReplyObject["title"];
      result.id = listReplyObject["id"];
    } else {
      console.log("sin mensaje");
    }
  } else {
    console.log("sin mensaje");
  }

  return result;
}

// Start whatsapp models
function messageText(textResponse: string, number: string) {
  const data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": number,
    "type": "text",
    "text": {
      "preview_url": false,
      "body": textResponse,
    },
  });

  return data;
}

function messageButtons(number){
  const data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": number,
    "type": "interactive",
    "interactive": {
        "type": "button",
        "body": {
            "text": "¡Hola, gusto en saludarte!"
            + "\nMi nombre es *MerkurBot* y estaré apoyandote en lo que necesites."
            + "\n\n¿Qué acción deseas realizar?"
        },
        "action": {
            "buttons": [
                {
                    "type": "reply",
                    "reply": {
                        "id": "001",
                        "title": "Agendar una cita"
                    }
                },
                {
                    "type": "reply",
                    "reply": {
                        "id": "002",
                        "title": "Hablar con un agente"
                    }
                },
                {
                    "type": "reply",
                    "reply": {
                        "id": "003",
                        "title": "Cancelar cita"
                    }
                }
            ]
        }
    }
  });
  return data;
}

function messageList(number: string, horarios: any[]): string {
  const data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": number,
    "type": "interactive",
    "interactive": {
      "type": "list",
      "header": {
        "type": "text",
        "text": "Horarios Disponibles",
      },
      "body": {
        "text": "Seleccione el horario que más se ajuste a sus necesidades",
      },
      "footer": {
        "text": "Todas las citas tienen duración de 1 hora",
      },
      "action": {
        "button": "Ver horarios",
        "sections": [
          {
            "title": "Horarios disponibles",
            "rows": horarios.map(horario => ({
              "id": horario.id,
              "title": horario.fecha,
              "description": horario.descripcion || "",
            })),
          },
        ],
      },
    },
  });

  return data;
}
// End whatsapp models

// Opcion agendar cita
async function agendarCita() {
  try {
    

    const resp = await getAllProfiles(supabaseClient);

    if (resp.ok) {
      const jsonResponse = await resp.json();
      const profiles = jsonResponse.profiles; // Se obtienen los perfiles

      if (profiles && profiles.length > 0) {
        const nextProfile = getNextProfile(profiles);
        const idProfile = nextProfile.id;
        console.log(idProfile);

        const fec = await getFechasPerProfile(supabaseClient, idProfile);

        if (fec.ok) {
          const jsonRes = await fec.json();
          const fechas = jsonRes.fechas; // Se obtienen las fechas


          fechas.sort((a, b) => compararFechas(a.fecha, b.fecha));

          console.log(fechas);

          // Formatear las fechas antes de devolverlas
          const fechasFormateadas = fechas.map((fechaObj) => {
            return {
              id: fechaObj.id,
              fecha: formatearFechas(fechaObj.fecha),
            };
          });

          return fechasFormateadas;
        } else {
          console.log("Error al obtener fechas:");
        }

      } else {
        console.log("No hay perfiles disponibles.");
      }
    } else {
      console.log("Error al obtener perfiles:");
    }
  } catch (error) {
    console.error("Hubo un error inesperado:", error);
  }
}

function compararFechas(a: string, b: string) {
  const fechaA = new Date(a);
  const fechaB = new Date(b);

  if (fechaA < fechaB) return -1;
  if (fechaA > fechaB) return 1;
  return 0;
}

// Format fechas
function formatearFechas(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
  const formatoFecha = new Intl.DateTimeFormat('es-MX', options);
  return formatoFecha.format(fecha);
}

function obtenerHoraDelDia(fecha: string): string {
  const fechaObj = new Date(fecha);
  const horas = fechaObj.getHours();
  const minutos = fechaObj.getMinutes();

  const ampm = horas >= 12 ? 'pm' : 'am';

  // Convertir a formato de 12 horas
  const horas12 = horas % 12 || 12;

  // Formatear los minutos con dos dígitos
  const minutosFormateados = minutos < 10 ? `0${minutos}` : `${minutos}`;

  return `${horas12}:${minutosFormateados} ${ampm}`;
}

// Process message
async function processMessage( textUser: string, number: string, id: string) { 
  textUser = textUser.toLowerCase();
  const models = [];

  if (textUser.includes("hola") || textUser.includes("buenos días") || textUser.includes("buenos dias") || textUser.includes("buen día") || textUser.includes("buen dia")){
    // Saludo
    const modelButtons = messageButtons(number);
    models.push(modelButtons);

  } else if(textUser.includes("gracias")){
    // Despedida
    const model = messageText("Gracias a ti, fue un placer atenderte \nDe parte de toda la familia Merkur te deseamos un excelente día", number);
    models.push(model);
  } else if(textUser == "agendar una cita"){

    const fechas = await agendarCita();
    if (fechas !== null) {

      // Enviar la lista de opciones dinámicas
      const model = messageList(number, fechas);
      models.push(model);

    } else {
      console.log("hubo un error al obtener las fechas");
    }

    
  } else if(textUser == "hablar con un agente" ){
    // Hablar con un agente

    try {
      const obtenerPerfiles = await getAllProfile(supabaseClient);

      if (obtenerPerfiles.ok) {
        const jsonResponse = await obtenerPerfiles.json();
        const agente = jsonResponse.profile;
        const profileID = agente.id;
        console.log(profileID);

        const obtenerChatPerNumber = await getChatPerPhone(supabaseClient, number);

        if(obtenerChatPerNumber.ok){
          const jsonResponse = await obtenerChatPerNumber.json();
          const chat = jsonResponse.getChatPerPhone;
          const ch = chat[0]
          const chatID = ch.id;
          const bot = "false";

          const resp = await updateChatsProfileBot(supabaseClient, profileID, bot, chatID);

          if (resp.ok){
            console.log("profile y bot actualizado en chats");
          } else {
            console.log(" no se puedo actualizar profile y bot en chats");
          }
        }else{
          console.log("No se pudo obtener el chat por numero")
        }
        
      } else {
        console.error("Error al obtener perfiles:", obtenerPerfiles.statusText);
      }
    } catch (error) {
      console.log("error general", error);
    }

  
    const model = messageText("Espere, se le esta transfiriendo con un agente", number);
    models.push(model);
  } else if(textUser == "cancelar cita" ){
    // Cancelar cita
    const model = messageText("Podría proporcionarme el folio de su cita en este formato: \n*Folio:su_folio*", number);
    models.push(model);

  } else if(textUser.includes("folio")){
    // Cancelar cita
    const partesFolio = textUser.split(':');
    const folio = partesFolio[1].trim();
    const status = "cancel";

    try {
      const resp = await updateStatusDates(supabaseClient, folio, status);

      if (resp.ok){
        console.log("status date actualizado correctamente");
      } else {
        console.log("ocurrio un error al intentar actualizar status de dates");
      }

      const res = await getFechaPerDate(supabaseClient, folio);
      if(res.ok){
        const jsonResponse = await res.json();
        const fechaId = jsonResponse.fechaPerDate;
        const primerFecha = fechaId[0];
        console.log(primerFecha);
        const idFec = primerFecha.fecha_id
        const state = "true";

        const re = await updateStatusFechas(supabaseClient, idFec, state);

        if (re.ok){
          console.log("Fecha actualizada y disponible nuevamente");
        }else{
          console.log("Ocurrio un error al intentar actualizar la fecha");
        }
      }else{
        console.log("ocurrio un error obtenindo el id de la fecha");
      }

    } catch (error) {
      console.error("Error general:", error);
    }

    const model = messageText(`Muy bien, su cita con folio: *${folio}* ha sido cancelada. \n¿Puedo apoyarlo en algo más?`, number);
    models.push(model);

  } else if(textUser.includes("a. m.") || textUser.includes("p. m.")){
    
    try {
      const id_fecha = id;
      const resp = await getProfilePerFechas(supabaseClient, id_fecha);

      if (resp.ok) {
        const jsonResponse = await resp.json();
        const profile = jsonResponse.profile; // Se obtienen los perfiles
        const primerPerfilFecha = profile[0];
        const idProfile = primerPerfilFecha.profile_id;
        const idFecha = primerPerfilFecha.fecha_id;

        const r = await insertDate(supabaseClient, id_fecha, idProfile, number);
        if (r.ok) {
          console.log("Se insertó la fecha correctamente en la tabla 'dates'");
        } else {
          console.log("Error al insertar la fecha en la tabla 'dates'", r.statusText);
        }
        const status = "false";

        const re = await updateStatusFechas(supabaseClient, idFecha, status);
        if (re.ok) {
          console.log("Se actualizó el estado de las fechas");
        } else {
          console.log("No se actualizó el estado de las fechas");
        }
      }else {
        console.error("La respuesta no contiene el campo 'profile' o está vacío.");
      }
    } catch (error) {
      console.error("Error general:", error);
    }

    const model = messageText("De acuerdo, podría proporcionarme su nombre completo y un correo electrónico en este formato: \n*Nombre Completo, Correo Electrónico*",number);
    models.push(model);
  } else if(textUser.includes("@")){

    const partes = textUser.split(',');
    const nombre = partes[0].trim(); 
    const correo = partes[1].trim();

    const nombreMayuscula = nombre.replace(/\b\w/g, (char) => char.toUpperCase());

    try {
      const res = await getProfileFechaDate(supabaseClient, number);

      if(res.ok){
        // console.log("entro en res.ok");
        const jsonResponse = await res.json();
        const dateId = jsonResponse.profileFechaDate;
        const dat = dateId[0];
        const idDat = dat.date_id
        console.log(idDat);

        const resp = await updateDates(supabaseClient, nombreMayuscula, correo, idDat, number);

        if(resp.ok){
          console.log("Date actualizada correctamente");
          const model = messageText(`Muy bien, he finalizado con el alta de su cita y su folio es: ${idDat} \n¿Puedo ayudarle con algo más?`, number);
          models.push(model);
        } else {
          console.log("Ocurrio un error al intentar actualizar el registro");
        }

      } else {
        console.log("hubo un error en getProfileFechaDate");
      }
    } catch (error) {
      console.error("Error general:", error);
    }

    
  } else if(textUser.includes("todo") || textUser.includes("gracias") || textUser.includes("no")){
    
    const model = messageText("Muy bien, de mi parte sería todo, si necesita algo más no dude en pedirmelo, estaré para apoyarlo \n De parte de toda la familia Merkur, le deseamos un excelente día", number);
    models.push(model);
  } else {
    // En caso de no entender
    const model = messageText('Disculpe, no puedo comprender su mensaje, intente escribiendo "*Hola*" ', number);
    models.push(model);
    console.log('Disculpe, no puedo comprender su mensaje, intente escribiendo "*Hola*" ');
  }

  models.forEach(async (model) => {
    await sendMessageWhatsapp(model);
  });
}

let profileIndex = 0; // Inicializamos el índice a 0

// Función para obtener el próximo perfil disponible
function getNextProfile(profiles: any[]): any {
  const nextProfile = profiles[profileIndex];
  profileIndex = (profileIndex + 1) % profiles.length; // Avanzamos al siguiente perfil y volvemos al principio si llegamos al final
  return nextProfile;
}

// Send message to user
async function sendMessageWhatsapp(data): Promise<void> {

  const options = {
    hostname: "graph.facebook.com",
    path: "/v18.0/235120333010937/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer EAAMuiUdZAZA0gBO0w707g6ZBKt3i3LZCBl0KG9TJwvYeDU6o4AZCEE3ZCSC0uqVwWKfwCsumHzxNiDRDPQjX7lqkmE8gpbAKYsh3NaPWBZCIQeihYE4Ed7Dfo00VF8jMQtISa2EFWtLaxeCnImUqHK3O40hwkdqfiYYltA4Nj44JUUiQG35ZC6kxukdbOZBrT",
    },
  };

  try {
    const res = await fetch(`https://${options.hostname}${options.path}`, {
      method: options.method,
      headers: options.headers,
      body: data,
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

  } catch (error) {
    console.error(error);
  }
}

// Get profile para cita
async function getAllProfiles(supabaseClient: SupabaseClient){
  const { data: profiles, error} = await supabaseClient.from('profiles').select('id, first_name, last_name, email, phone, position_id').eq('position_id', '68b38674-47e9-40ac-b3ed-7d6ac724a0aa')
  if(error) throw error

  return new Response(JSON.stringify({ profiles }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}
// Get profile para agente
async function getAllProfile(supabaseClient: SupabaseClient){
  const { data: profiles, error} = await supabaseClient.from('profiles').select('id').eq('position_id', '68b38674-47e9-40ac-b3ed-7d6ac724a0aa')
  if(error) throw error

  if (profiles && profiles.length > 0) {
    // Si hay varios perfiles, elige uno aleatorio
    const randomIndex = Math.floor(Math.random() * profiles.length);
    const randomProfile = profiles[randomIndex];
    return new Response(JSON.stringify({ profile: randomProfile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } else {
    // Si no hay perfiles o solo hay uno, devolverlo directamente
    return new Response(JSON.stringify({ profile: profiles[0] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
}

// Get fechas per profile
async function getFechasPerProfile(supabaseClient: SupabaseClient, profile_id: any){
  const { data: fechas, error} = await supabaseClient.from('fechas').select('id, fecha').eq('profile_id', profile_id).eq('status', true);
  if(error) throw error

  return new Response(JSON.stringify({ fechas }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

//Get Profile per fechas
async function getProfilePerFechas(supabaseClient: SupabaseClient, fecha_id: any){
  const { data: profile, error} = await supabaseClient.from('profiles_fecha').select('profile_id, fecha_id').eq('fecha_id', fecha_id);
  if(error) throw error

  return new Response(JSON.stringify({ profile }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Update status fechas
async function updateStatusFechas(supabaseClient: SupabaseClient, fecha_id: any, status:string){
  const { data: status_fecha, error} = await supabaseClient.from('fechas').update({ status: status }).eq('id', fecha_id).select();
  if(error) throw error

  return new Response(JSON.stringify({ status_fecha }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Create date whit fecha, profile id y phone number (part 1)
async function insertDate(supabaseClient: SupabaseClient, fecha_id: any, profile_id: any, number: string){
  const { data: insertDate, error} = await supabaseClient.from('dates').insert([
    { full_name: '', email: '', phone: number, status: 'activa', fechas_id: fecha_id, chatBot_option_id: 'a69bb9ab-e32e-4be6-986b-b8085033e0f3' , profile_id: profile_id},
  ]).select();
  if(error) throw error

  return new Response(JSON.stringify({ insertDate }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Get profile_fecha_date (part 2)
async function getProfileFechaDate(supabaseClient: SupabaseClient, number: string) {
  try {
    const { data: profileFechaDate, error } = await supabaseClient
      .from('profiles_fecha_dates')
      .select('date_id')
      .eq('phone', number)
      .eq('full_name', '')
      .eq('email', '');

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ profileFechaDate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error en la consulta:", error);

    return new Response(JSON.stringify({ error: "Error en la consulta" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}


//Update dates (part 3)
async function updateDates(supabaseClient: SupabaseClient, fullname:string, email:string, idDate:string, number:string){
  const { data: uDates, error} = await supabaseClient.from('dates').update({ full_name: fullname, email: email }).eq('id', idDate).eq('phone', number);
  if(error) throw error

  return new Response(JSON.stringify({ uDates }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Update status date
async function updateStatusDates(supabaseClient: SupabaseClient, idDate:string, status:string){
  const { data: sDates, error} = await supabaseClient.from('dates').update({ status: status }).eq('id', idDate);
  if(error) throw error

  return new Response(JSON.stringify({ sDates }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Get fecha per date (Cancel date)
async function getFechaPerDate(supabaseClient: SupabaseClient, date_id:string){
  const { data: fechaPerDate, error} = await supabaseClient.from('profiles_fecha_dates').select('fecha_id').eq('date_id', date_id);
  if(error) throw error

  return new Response(JSON.stringify({ fechaPerDate }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Create chat_messages
async function insertChatMessages(supabaseClient: SupabaseClient, message:string, isUser:string, chatId:string){
  const { data: insertChatMessages, error} = await supabaseClient.from('chat_messages').insert([
    { message: message, message_read: 'false', is_user: isUser, chat_id: chatId},
  ]).select();
  if(error) throw error

  return new Response(JSON.stringify({ insertChatMessages }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Update last_message_time chats
async function updateChats(supabaseClient: SupabaseClient, lastMessageTime:string, idChat:string){
  const { data: updateChats, error} = await supabaseClient.from('chats').update({ last_message_time: lastMessageTime }).eq('id', idChat);
  if(error) throw error

  return new Response(JSON.stringify({ updateChats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// update id_profile and bot on chats
async function updateChatsProfileBot(supabaseClient: SupabaseClient, idProfile:string, bot: string, idChat:string){
  const { data: updateChats, error} = await supabaseClient.from('chats').update({ profile_id: idProfile, bot: bot}).eq('id', idChat);
  if(error) throw error

  return new Response(JSON.stringify({ updateChats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Get verify bot or agent
async function getBotOrAgent(supabaseClient: SupabaseClient, number:string){
  const { data: botOrAgent, error} = await supabaseClient.from('chats').select('bot').eq('phone_number', number);
  if(error) throw error

  return new Response(JSON.stringify({ botOrAgent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

//get chat per phone
async function getChatPerPhone(supabaseClient: SupabaseClient, number:string){
  const { data: getChatPerPhone, error} = await supabaseClient.from('chats').select('id').eq('phone_number', number);
  if(error) throw error

  return new Response(JSON.stringify({ getChatPerPhone }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// verificar si existe el numero iserta y si no actualiza
async function upsertChatPerNumber(supabaseClient: SupabaseClient, message: string, number: number) {
  try {
    const { data: upsertChatPerNumber, error } = await supabaseClient.from('chats').upsert({last_message: message,phone_number: number, read_message: 'false', bot: 'true'}, { onConflict: 'phone_number' }).select();

    if (error) {
      // Imprime el objeto 'error' para obtener más información
      console.error('Error al insertar o actualizar datos del chat:', error);

      // Maneja el error adecuadamente en base a la información del error
      return new Response('Error al insertar o actualizar datos del chat', {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ upsertChatPerNumber }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    // Maneja errores inesperados
    return new Response('Ocurrió un error inesperado', {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

// get last_message_time on chat_message
async function getLastMessageTime(supabaseClient: SupabaseClient, chatId:string){
  const { data: getLastMessageTime, error} = await supabaseClient.from('chat_messages').select('created_at').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(1);
  if(error) throw error

  return new Response(JSON.stringify({ getLastMessageTime }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

async function getChatPerPhoneProfileBot(supabaseClient: SupabaseClient, number:string){
  const { data: getChatPerPhone, error} = await supabaseClient.from('chats').select('bot, profile_id, phone_number').eq('phone_number', number);
  if(error) throw error

  return new Response(JSON.stringify({ getChatPerPhone }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// endpoints
serve(async (req) => {

  const { url, method } = req

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {

    const whatsappApi = new URLPattern({ pathname: '/chatBot/whatsapp'});
    const matchingPathWhatsApp = whatsappApi.exec(url);

    switch (true) {
      case method == 'GET': {
        try {
          const access = "h824r7h239dj23890dj49837fh3489";
          const queryParams = new URLSearchParams(url.search);
          const token =  queryParams.get("hub.verify_token");
          const challenge = queryParams.get("hub.challenge");

          if (challenge != null && token != null && token == access) {
            return new Response(challenge, {
              headers: { corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            })
          } else {
            return new Response(JSON.stringify({ error: error.message }), {
              headers: { corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            })
          }
      
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
      }
      case method == 'POST': {
        try {
          const requestBody = await req.json();
          const entry = requestBody?.entry?.[0];
          const changes = (entry["changes"])[0];
          const value = changes["value"];
          const messageObject = value["messages"];

          if ( typeof messageObject != "undefined") {
            const messages = messageObject[0];
            const { text, id } = getTextUser(messages);
            const number = messages["from"];
            const cleanNumber = number.slice(0, 2) + number.slice(3);

            if ( text !== ""){
              //Guardar mensaje antes de procesarlo al bot
              try {
                const existchatResponse  = await upsertChatPerNumber(supabaseClient, text, cleanNumber);

                if (existchatResponse.ok) {
                  const resp = await getChatPerPhone(supabaseClient, cleanNumber);
                  
                  if(resp.ok){
                    const jsonResponse = await resp.json();
                    const chat = jsonResponse.getChatPerPhone;
                    const ch = chat[0]
                    const chatID = ch.id;
                    const isUser = "true";

                    const res = await insertChatMessages(supabaseClient, text, isUser, chatID);

                    if(res.ok){
                      
                      const re = await getLastMessageTime(supabaseClient, chatID);

                      if(re.ok){
                        const jsonResponse = await re.json();
                        const date = jsonResponse.getLastMessageTime;
                        const da = date[0];
                        const lastMessageTime = da.created_at;

                        const updateDateLastMessageChats = await updateChats(supabaseClient, lastMessageTime, chatID);
                      }
                    }else{
                      console.log("no se inserto en chat_messages");
                    }
                  } else {
                    console.log("No se pudo obtener el id del chat");
                  }
                } else {
                  console.log("No se realizo la consulta");
                }
              } catch (error) {
                console.error("Error al consultar el chat por número:", error);
              }

              const validacionBotOrAgent = await getChatPerPhoneProfileBot(supabaseClient, cleanNumber);
              if(validacionBotOrAgent.ok){
                const jsonResponse = await validacionBotOrAgent.json();
                const ObjectChat = jsonResponse.getChatPerPhone;
                const objChat = ObjectChat[0];

                const row_bot = objChat.bot;
                const row_profile_id = objChat.profile_id;
                const row_phone_number = objChat.phone_number;

                if (row_phone_number == cleanNumber && row_profile_id === null){
                  await processMessage(text, cleanNumber, id);

                  return new Response("EVENT RECEIVED", {
                    headers: { corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                  })
                }else {
                  console.log("hablando con agente");

                  return new Response("EVENT RECEIVED", {
                    headers: { corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                  })
                }
              } else{
                console.log("no se ejecuto el get a la tabla chat");
              }
            }
          }
        } catch (error) {
          return new Response("EVENT RECEIVED", {
            headers: { corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

      }
      default: // If this is neither a POST, or a GET return a 405 response.
        return new Response("Method Not Allowed", { status: 405 });
    }
    

  } catch (err) {
    console.error(err)
  }
});