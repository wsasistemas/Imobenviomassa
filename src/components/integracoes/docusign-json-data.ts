export type Endpoint = {
  id: string;
  categoria: "auth" | "templates" | "envelopes";
  titulo: string;
  metodo: "GET" | "POST";
  path: string;
  headers: Record<string, string>;
  bodyType?: "form" | "json";
  body?: string;
  response: string;
  notas?: string[];
  implementadoEm?: string;
};

export const CATEGORIAS: { id: Endpoint["categoria"]; label: string }[] = [
  { id: "auth", label: "1. Autenticação JWT" },
  { id: "templates", label: "2. Templates" },
  { id: "envelopes", label: "3. Envelopes" },
];

export const ENDPOINTS: Endpoint[] = [
  {
    id: "auth-token",
    categoria: "auth",
    titulo: "Obter Access Token",
    metodo: "POST",
    path: "{{auth_url}}/oauth/token",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    bodyType: "form",
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
assertion={{jwt_assertion}}`,
    response: `{
  "access_token": "eyJ0eXAiOiJNVCIsImFsZyI6...",
  "token_type": "Bearer",
  "expires_in": 3600
}`,
    notas: [
      "O jwt_assertion é um JWT assinado com a chave RSA privada.",
      "O SDK monta isso automaticamente via requestJWTUserToken.",
      "Salve access_token como variável de ambiente access_token.",
    ],
    implementadoEm: "getAccessToken (interno, chamado por toda função DocuSign)",
  },
  {
    id: "tpl-list",
    categoria: "templates",
    titulo: "Listar templates da conta",
    metodo: "GET",
    path: "{{base_url}}/accounts/{{account_id}}/templates?shared=false",
    headers: { Authorization: "Bearer {{access_token}}" },
    response: `{
  "totalSetSize": "3",
  "envelopeTemplates": [
    {
      "templateId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "Arte Jardim - Kit Porcelanato - ÚNICO COMPRADOR",
      "description": "",
      "shared": "false",
      "created": "2024-01-15T10:00:00.0000000Z",
      "lastModified": "2024-06-01T14:30:00.0000000Z"
    }
  ]
}`,
    implementadoEm: "listarTemplatesDocusign / listarModelosDocusign",
  },
  {
    id: "tpl-detail",
    categoria: "templates",
    titulo: "Detalhes de um template",
    metodo: "GET",
    path: "{{base_url}}/accounts/{{account_id}}/templates/{{template_id}}",
    headers: { Authorization: "Bearer {{access_token}}" },
    response: `{
  "templateId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "Arte Jardim - Kit Porcelanato",
  "emailSubject": "Por favor assine o documento",
  "status": "created",
  "shared": "false"
}`,
    implementadoEm: "obterTemplateDocusign",
  },
  {
    id: "tpl-roles",
    categoria: "templates",
    titulo: "Papéis (roles) de um template",
    metodo: "GET",
    path: "{{base_url}}/accounts/{{account_id}}/templates/{{template_id}}/recipients",
    headers: { Authorization: "Bearer {{access_token}}" },
    response: `{
  "signers": [
    {
      "roleName": "CLIENTE 1",
      "recipientId": "1",
      "routingOrder": "1",
      "name": "",
      "email": ""
    },
    {
      "roleName": "CLIENTE 2",
      "recipientId": "2",
      "routingOrder": "2",
      "name": "",
      "email": ""
    }
  ]
}`,
    implementadoEm: "obterTemplateDocusign",
  },
  {
    id: "tpl-docs",
    categoria: "templates",
    titulo: "Documentos de um template",
    metodo: "GET",
    path: "{{base_url}}/accounts/{{account_id}}/templates/{{template_id}}/documents",
    headers: { Authorization: "Bearer {{access_token}}" },
    response: `{
  "templateDocuments": [
    {
      "documentId": "1",
      "name": "Contrato.pdf",
      "fileExtension": "pdf",
      "order": "1"
    }
  ]
}`,
    implementadoEm: "obterTemplateDocusign",
  },
  {
    id: "tpl-preview",
    categoria: "templates",
    titulo: "Gerar preview de template (iframe)",
    metodo: "POST",
    path: "{{base_url}}/accounts/{{account_id}}/templates/{{template_id}}/views/recipient_preview",
    headers: {
      Authorization: "Bearer {{access_token}}",
      "Content-Type": "application/json",
    },
    bodyType: "json",
    body: `{
  "returnUrl": "https://seuapp.com",
  "authenticationMethod": "none",
  "recipientId": "1",
  "xFrameOptions": "allow_from",
  "xFrameOptionsAllowFromUrl": "https://seuapp.com"
}`,
    response: `{
  "url": "https://demo.docusign.net/Signing/MTRedeem/v1/eyJ0eX..."
}`,
    notas: ["A URL expira em ~5 minutos. Use em um <iframe src=\"...\">."],
    implementadoEm: "gerarPreviewTemplateDocusign",
  },
  {
    id: "env-create-1",
    categoria: "envelopes",
    titulo: "Criar e enviar envelope (1 comprador via template)",
    metodo: "POST",
    path: "{{base_url}}/accounts/{{account_id}}/envelopes",
    headers: {
      Authorization: "Bearer {{access_token}}",
      "Content-Type": "application/json",
    },
    bodyType: "json",
    body: `{
  "status": "sent",
  "emailSubject": "Documento para assinar",
  "templateId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "templateRoles": [
    {
      "email": "joao@exemplo.com",
      "name": "João da Silva",
      "roleName": "CLIENTE 1",
      "tabs": {
        "textTabs": [
          { "tabLabel": "CPF",      "value": "123.456.789-00" },
          { "tabLabel": "Unidade",  "value": "101" },
          { "tabLabel": "Bloco",    "value": "A" }
        ]
      }
    }
  ]
}`,
    response: `{
  "envelopeId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "status": "sent",
  "statusDateTime": "2024-07-01T10:00:00.0000000Z",
  "uri": "/envelopes/yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
}`,
    implementadoEm: "enviarEnvelopeDocusign",
  },
  {
    id: "env-create-2",
    categoria: "envelopes",
    titulo: "Criar envelope com 2 compradores (1 assina, 2 recebe cópia)",
    metodo: "POST",
    path: "{{base_url}}/accounts/{{account_id}}/envelopes",
    headers: {
      Authorization: "Bearer {{access_token}}",
      "Content-Type": "application/json",
    },
    bodyType: "json",
    body: `{
  "status": "sent",
  "emailSubject": "Documento para assinar",
  "templateId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "templateRoles": [
    {
      "email": "joao@exemplo.com",
      "name": "João da Silva",
      "roleName": "CLIENTE 1",
      "tabs": {
        "textTabs": [
          { "tabLabel": "CPF",      "value": "123.456.789-00" },
          { "tabLabel": "Unidade",  "value": "101" },
          { "tabLabel": "Bloco",    "value": "A" }
        ]
      }
    }
  ],
  "recipients": {
    "carbonCopies": [
      {
        "email": "maria@exemplo.com",
        "name": "Maria Souza",
        "recipientId": "2",
        "routingOrder": "2"
      }
    ]
  }
}`,
    response: `{
  "envelopeId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "status": "sent"
}`,
    implementadoEm: "enviarEnvelopeDocusign (com carbonCopies)",
  },
  {
    id: "env-create-wa",
    categoria: "envelopes",
    titulo: "Criar envelope via WhatsApp (composite template)",
    metodo: "POST",
    path: "{{base_url}}/accounts/{{account_id}}/envelopes",
    headers: {
      Authorization: "Bearer {{access_token}}",
      "Content-Type": "application/json",
    },
    bodyType: "json",
    body: `{
  "status": "sent",
  "emailSubject": "Documento para assinar",
  "compositeTemplates": [
    {
      "compositeTemplateId": "1",
      "serverTemplates": [
        {
          "sequence": "1",
          "templateId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        }
      ],
      "inlineTemplates": [
        {
          "sequence": "2",
          "recipients": {
            "signers": [
              {
                "email": "joao@exemplo.com",
                "name": "João da Silva",
                "recipientId": "1",
                "routingOrder": "1",
                "roleName": "CLIENTE 1",
                "additionalNotifications": [
                  {
                    "secondaryDeliveryMethod": "WhatsApp",
                    "phoneNumber": {
                      "countryCode": "55",
                      "number": "11999990000"
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}`,
    response: `{
  "envelopeId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "status": "sent"
}`,
    implementadoEm: "enviarEnvelopeDocusign (viaWhatsapp: true)",
  },
  {
    id: "env-status",
    categoria: "envelopes",
    titulo: "Buscar status de um envelope",
    metodo: "GET",
    path: "{{base_url}}/accounts/{{account_id}}/envelopes/{{envelope_id}}",
    headers: { Authorization: "Bearer {{access_token}}" },
    response: `{
  "envelopeId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "status": "completed",
  "sentDateTime": "2024-07-01T10:00:00.0000000Z",
  "completedDateTime": "2024-07-01T11:30:00.0000000Z",
  "emailSubject": "Documento para assinar"
}`,
    notas: [
      "created = Rascunho (não enviado)",
      "sent = Enviado, aguardando assinatura",
      "delivered = Visualizado pelo destinatário",
      "completed = Assinado por todos",
      "declined = Recusado por algum destinatário",
      "voided = Cancelado",
    ],
    implementadoEm: "consultarStatusEnvelopeDocusign",
  },
  {
    id: "env-recipients",
    categoria: "envelopes",
    titulo: "Listar destinatários de um envelope",
    metodo: "GET",
    path: "{{base_url}}/accounts/{{account_id}}/envelopes/{{envelope_id}}/recipients",
    headers: { Authorization: "Bearer {{access_token}}" },
    response: `{
  "signers": [
    {
      "name": "João da Silva",
      "email": "joao@exemplo.com",
      "recipientId": "1",
      "status": "completed",
      "signedDateTime": "2024-07-01T11:30:00.0000000Z",
      "deliveredDateTime": "2024-07-01T10:05:00.0000000Z"
    }
  ],
  "carbonCopies": [
    {
      "name": "Maria Souza",
      "email": "maria@exemplo.com",
      "recipientId": "2",
      "status": "delivered"
    }
  ]
}`,
    implementadoEm: "listarDestinatariosEnvelopeDocusign",
  },
];

export const ERROS_COMUNS: { http: string; codigo: string; causa: string }[] = [
  { http: "401", codigo: "PARTNER_AUTHENTICATION_FAILED", causa: "Token expirado ou inválido" },
  { http: "401", codigo: "consent_required", causa: "Consentimento JWT não foi dado pelo usuário" },
  {
    http: "400",
    codigo: "INVALID_EMAIL_ADDRESS_FOR_RECIPIENT",
    causa: "E-mail do destinatário inválido",
  },
  {
    http: "400",
    codigo: "TEMPLATE_ROLE_NAME_NOT_FOUND",
    causa: "Nome do papel não existe no template",
  },
  {
    http: "429",
    codigo: "HOURLY_APIINVOCATION_LIMIT_EXCEEDED",
    causa: "Limite de 1.000 chamadas/hora atingido",
  },
];
