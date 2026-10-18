export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          bloco: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          created_at: string
          created_by: string | null
          data_agendamento: string
          empreendimento_id: string | null
          empreendimento_nome: string | null
          finalizado_em: string | null
          finalizado_por: string | null
          hora_fim: string | null
          hora_inicio: string
          id: string
          modulo: string
          motivo_cancelamento: string | null
          numero_atendimento: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["atendimento_status"]
          tecnico_nome: string | null
          tecnico_responsavel_id: string | null
          tipo_atendimento_id: string | null
          titulo: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          bloco?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          created_by?: string | null
          data_agendamento: string
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          hora_fim?: string | null
          hora_inicio: string
          id?: string
          modulo?: string
          motivo_cancelamento?: string | null
          numero_atendimento?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["atendimento_status"]
          tecnico_nome?: string | null
          tecnico_responsavel_id?: string | null
          tipo_atendimento_id?: string | null
          titulo: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          bloco?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          created_by?: string | null
          data_agendamento?: string
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          hora_fim?: string | null
          hora_inicio?: string
          id?: string
          modulo?: string
          motivo_cancelamento?: string | null
          numero_atendimento?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["atendimento_status"]
          tecnico_nome?: string | null
          tecnico_responsavel_id?: string | null
          tipo_atendimento_id?: string | null
          titulo?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_tipo_atendimento_id_fkey"
            columns: ["tipo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_channel_routing: {
        Row: {
          business_hours: Json
          channel_id: string
          created_at: string
          fallback_to_human: boolean
          fora_horario_msg: string | null
          handoff_keywords: string[]
          max_ai_turns: number
          modo: string
          updated_at: string
        }
        Insert: {
          business_hours?: Json
          channel_id: string
          created_at?: string
          fallback_to_human?: boolean
          fora_horario_msg?: string | null
          handoff_keywords?: string[]
          max_ai_turns?: number
          modo?: string
          updated_at?: string
        }
        Update: {
          business_hours?: Json
          channel_id?: string
          created_at?: string
          fallback_to_human?: boolean
          fora_horario_msg?: string | null
          handoff_keywords?: string[]
          max_ai_turns?: number
          modo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_channel_routing_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "ai_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_channels: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          display_phone: string | null
          id: string
          nome: string
          observacoes: string | null
          phone_number_id: string | null
          preset_id: string | null
          provider: string
          status: string
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          display_phone?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          phone_number_id?: string | null
          preset_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          display_phone?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          phone_number_id?: string | null
          preset_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_channels_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          ai_turns: number
          assigned_to: string | null
          channel_id: string | null
          claimed_at: string | null
          cliente_id: string | null
          contact_name: string | null
          contact_phone: string
          cpf_identificado: string | null
          created_at: string
          handoff_reason: string | null
          handoff_tag: string | null
          id: string
          last_message_at: string
          metadata: Json
          preset_id: string | null
          priority: number
          queued_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_turns?: number
          assigned_to?: string | null
          channel_id?: string | null
          claimed_at?: string | null
          cliente_id?: string | null
          contact_name?: string | null
          contact_phone: string
          cpf_identificado?: string | null
          created_at?: string
          handoff_reason?: string | null
          handoff_tag?: string | null
          id?: string
          last_message_at?: string
          metadata?: Json
          preset_id?: string | null
          priority?: number
          queued_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_turns?: number
          assigned_to?: string | null
          channel_id?: string | null
          claimed_at?: string | null
          cliente_id?: string | null
          contact_name?: string | null
          contact_phone?: string
          cpf_identificado?: string | null
          created_at?: string
          handoff_reason?: string | null
          handoff_tag?: string | null
          id?: string
          last_message_at?: string
          metadata?: Json
          preset_id?: string | null
          priority?: number
          queued_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "ai_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inbound_messages: {
        Row: {
          channel_id: string | null
          erro: string | null
          external_id: string | null
          from_phone: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          channel_id?: string | null
          erro?: string | null
          external_id?: string | null
          from_phone?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Update: {
          channel_id?: string | null
          erro?: string | null
          external_id?: string | null
          from_phone?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inbound_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "ai_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          model: string | null
          sender: string
          sent_by: string | null
          tokens_in: number | null
          tokens_out: number | null
          tool_calls: Json | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          external_id?: string | null
          id?: string
          model?: string | null
          sender: string
          sent_by?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          model?: string | null
          sender?: string
          sent_by?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_presets: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          description: string | null
          escopo: string
          id: string
          is_default: boolean
          kb_overrides: Json | null
          max_tokens: number | null
          model: string
          name: string
          reasoning_effort: string | null
          streaming: boolean
          system_prompt: string | null
          temperature: number | null
          tools_enabled: string[] | null
          tools_json: Json | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          escopo?: string
          id?: string
          is_default?: boolean
          kb_overrides?: Json | null
          max_tokens?: number | null
          model?: string
          name: string
          reasoning_effort?: string | null
          streaming?: boolean
          system_prompt?: string | null
          temperature?: number | null
          tools_enabled?: string[] | null
          tools_json?: Json | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          escopo?: string
          id?: string
          is_default?: boolean
          kb_overrides?: Json | null
          max_tokens?: number | null
          model?: string
          name?: string
          reasoning_effort?: string | null
          streaming?: boolean
          system_prompt?: string | null
          temperature?: number | null
          tools_enabled?: string[] | null
          tools_json?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      api_registry: {
        Row: {
          auth_secret_ref: string | null
          auth_type: string
          base_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          endpoint: string
          id: string
          method: string
          name: string
          params_schema: Json | null
          soap_action: string | null
          soap_envelope_template: string | null
          soap_response_path: string | null
          soap_service: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          auth_secret_ref?: string | null
          auth_type?: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoint: string
          id?: string
          method?: string
          name: string
          params_schema?: Json | null
          soap_action?: string | null
          soap_envelope_template?: string | null
          soap_response_path?: string | null
          soap_service?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          auth_secret_ref?: string | null
          auth_type?: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoint?: string
          id?: string
          method?: string
          name?: string
          params_schema?: Json | null
          soap_action?: string | null
          soap_envelope_template?: string | null
          soap_response_path?: string | null
          soap_service?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          label: string
          role_mapping: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          label: string
          role_mapping: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          role_mapping?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      assistente_kb: {
        Row: {
          ativo: boolean
          chave: string
          conteudo: string
          created_at: string
          created_by: string | null
          id: string
          prioridade: number
          tags: string[]
          tipo: Database["public"]["Enums"]["assistente_kb_tipo"]
          titulo: string
          updated_at: string
          updated_by: string | null
          versao: number
        }
        Insert: {
          ativo?: boolean
          chave: string
          conteudo: string
          created_at?: string
          created_by?: string | null
          id?: string
          prioridade?: number
          tags?: string[]
          tipo: Database["public"]["Enums"]["assistente_kb_tipo"]
          titulo: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Update: {
          ativo?: boolean
          chave?: string
          conteudo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prioridade?: number
          tags?: string[]
          tipo?: Database["public"]["Enums"]["assistente_kb_tipo"]
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Relationships: []
      }
      assistente_kb_historico: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          ativo_anterior: boolean | null
          chave: string
          conteudo_anterior: string | null
          id: string
          kb_id: string | null
          tipo: Database["public"]["Enums"]["assistente_kb_tipo"]
          titulo_anterior: string | null
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          ativo_anterior?: boolean | null
          chave: string
          conteudo_anterior?: string | null
          id?: string
          kb_id?: string | null
          tipo: Database["public"]["Enums"]["assistente_kb_tipo"]
          titulo_anterior?: string | null
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          ativo_anterior?: boolean | null
          chave?: string
          conteudo_anterior?: string | null
          id?: string
          kb_id?: string | null
          tipo?: Database["public"]["Enums"]["assistente_kb_tipo"]
          titulo_anterior?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistente_kb_historico_kb_id_fkey"
            columns: ["kb_id"]
            isOneToOne: false
            referencedRelation: "assistente_kb"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_fotos: {
        Row: {
          atendimento_id: string
          created_at: string
          foto_url: string
          id: string
          legenda: string | null
        }
        Insert: {
          atendimento_id: string
          created_at?: string
          foto_url: string
          id?: string
          legenda?: string | null
        }
        Update: {
          atendimento_id?: string
          created_at?: string
          foto_url?: string
          id?: string
          legenda?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_fotos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos: {
        Row: {
          agendamento_id: string | null
          assinatura_url: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cliente_id: string | null
          created_at: string
          descricao: string | null
          empreendimento_id: string | null
          finalizado_em: string | null
          finalizado_por: string | null
          id: string
          materiais: string | null
          numero_atendimento: string | null
          observacoes_cancelamento: string | null
          prioridade: string
          status: Database["public"]["Enums"]["atendimento_status"]
          tecnico_id: string | null
          tecnico_responsavel_id: string | null
          tipo_atendimento_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          assinatura_url?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          empreendimento_id?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          id?: string
          materiais?: string | null
          numero_atendimento?: string | null
          observacoes_cancelamento?: string | null
          prioridade?: string
          status?: Database["public"]["Enums"]["atendimento_status"]
          tecnico_id?: string | null
          tecnico_responsavel_id?: string | null
          tipo_atendimento_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          assinatura_url?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          empreendimento_id?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          id?: string
          materiais?: string | null
          numero_atendimento?: string | null
          observacoes_cancelamento?: string | null
          prioridade?: string
          status?: Database["public"]["Enums"]["atendimento_status"]
          tecnico_id?: string | null
          tecnico_responsavel_id?: string | null
          tipo_atendimento_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_id: string | null
          category_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_id?: string | null
          category_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_id?: string | null
          category_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      boleto_geracao_log: {
        Row: {
          bloco: string | null
          cod_coligada: string | null
          cod_empreendimento: string | null
          cpf_cliente: string | null
          created_at: string
          duracao_ms: number | null
          erro_mensagem: string | null
          etapa_atual: number
          id: string
          id_boleto_antigo: string | null
          id_boleto_novo: string | null
          id_lans: Json | null
          payload: Json | null
          resposta: Json | null
          status: string
          unidade: string | null
          user_id: string
        }
        Insert: {
          bloco?: string | null
          cod_coligada?: string | null
          cod_empreendimento?: string | null
          cpf_cliente?: string | null
          created_at?: string
          duracao_ms?: number | null
          erro_mensagem?: string | null
          etapa_atual: number
          id?: string
          id_boleto_antigo?: string | null
          id_boleto_novo?: string | null
          id_lans?: Json | null
          payload?: Json | null
          resposta?: Json | null
          status: string
          unidade?: string | null
          user_id: string
        }
        Update: {
          bloco?: string | null
          cod_coligada?: string | null
          cod_empreendimento?: string | null
          cpf_cliente?: string | null
          created_at?: string
          duracao_ms?: number | null
          erro_mensagem?: string | null
          etapa_atual?: number
          id?: string
          id_boleto_antigo?: string | null
          id_boleto_novo?: string | null
          id_lans?: Json | null
          payload?: Json | null
          resposta?: Json | null
          status?: string
          unidade?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bulk_alert_configs: {
        Row: {
          backup_automatico: boolean
          created_at: string
          id: string
          limite_erro_pct: number
          notificar_conclusao: boolean
          notificar_erro_critico: boolean
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          backup_automatico?: boolean
          created_at?: string
          id?: string
          limite_erro_pct?: number
          notificar_conclusao?: boolean
          notificar_erro_critico?: boolean
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          backup_automatico?: boolean
          created_at?: string
          id?: string
          limite_erro_pct?: number
          notificar_conclusao?: boolean
          notificar_erro_critico?: boolean
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      bulk_api_health: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          latencia_ms: number | null
          numero_id: string | null
          ok: boolean
          provedor: string | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          latencia_ms?: number | null
          numero_id?: string | null
          ok?: boolean
          provedor?: string | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          latencia_ms?: number | null
          numero_id?: string | null
          ok?: boolean
          provedor?: string | null
          status_code?: number | null
        }
        Relationships: []
      }
      bulk_api_keys: {
        Row: {
          ativo: boolean
          created_at: string
          expira_em: string | null
          id: string
          key_hash: string
          key_prefix: string
          nome: string
          permissoes: string[]
          rate_limit_por_minuto: number
          total_chamadas: number
          ultimo_uso_em: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          expira_em?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          nome: string
          permissoes?: string[]
          rate_limit_por_minuto?: number
          total_chamadas?: number
          ultimo_uso_em?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          expira_em?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          nome?: string
          permissoes?: string[]
          rate_limit_por_minuto?: number
          total_chamadas?: number
          ultimo_uso_em?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_campanhas: {
        Row: {
          ab_test: Json | null
          agendada_para: string | null
          canal: string
          created_at: string
          custo_por_msg: number
          email_assunto: string | null
          email_cc: string | null
          email_remetente_email: string | null
          email_remetente_nome: string | null
          email_template_id: string | null
          finished_at: string | null
          id: string
          janela_fim: string | null
          janela_inicio: string | null
          max_tentativas: number
          nome: string
          numero_id: string | null
          pausa_feriados: boolean
          prioridade: number
          rate_limit_ms: number
          receita_estimada: number
          recorrencia: Json | null
          started_at: string | null
          status: string
          template_key: string | null
          texto_livre: string | null
          tipo_mensagem: string
          total_aberturas: number
          total_destinatarios: number
          total_entregues: number
          total_enviados: number
          total_erros: number
          total_lidos: number
          total_rejeitados: number
          updated_at: string
          user_id: string
          variaveis: Json
          variaveis_map: Json | null
        }
        Insert: {
          ab_test?: Json | null
          agendada_para?: string | null
          canal?: string
          created_at?: string
          custo_por_msg?: number
          email_assunto?: string | null
          email_cc?: string | null
          email_remetente_email?: string | null
          email_remetente_nome?: string | null
          email_template_id?: string | null
          finished_at?: string | null
          id?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          max_tentativas?: number
          nome: string
          numero_id?: string | null
          pausa_feriados?: boolean
          prioridade?: number
          rate_limit_ms?: number
          receita_estimada?: number
          recorrencia?: Json | null
          started_at?: string | null
          status?: string
          template_key?: string | null
          texto_livre?: string | null
          tipo_mensagem?: string
          total_aberturas?: number
          total_destinatarios?: number
          total_entregues?: number
          total_enviados?: number
          total_erros?: number
          total_lidos?: number
          total_rejeitados?: number
          updated_at?: string
          user_id: string
          variaveis?: Json
          variaveis_map?: Json | null
        }
        Update: {
          ab_test?: Json | null
          agendada_para?: string | null
          canal?: string
          created_at?: string
          custo_por_msg?: number
          email_assunto?: string | null
          email_cc?: string | null
          email_remetente_email?: string | null
          email_remetente_nome?: string | null
          email_template_id?: string | null
          finished_at?: string | null
          id?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          max_tentativas?: number
          nome?: string
          numero_id?: string | null
          pausa_feriados?: boolean
          prioridade?: number
          rate_limit_ms?: number
          receita_estimada?: number
          recorrencia?: Json | null
          started_at?: string | null
          status?: string
          template_key?: string | null
          texto_livre?: string | null
          tipo_mensagem?: string
          total_aberturas?: number
          total_destinatarios?: number
          total_entregues?: number
          total_enviados?: number
          total_erros?: number
          total_lidos?: number
          total_rejeitados?: number
          updated_at?: string
          user_id?: string
          variaveis?: Json
          variaveis_map?: Json | null
        }
        Relationships: []
      }
      bulk_contato_logs: {
        Row: {
          contato_id: string
          created_at: string
          descricao: string | null
          id: string
          metadata: Json | null
          tipo: string
          user_id: string
        }
        Insert: {
          contato_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          tipo: string
          user_id: string
        }
        Update: {
          contato_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_contato_logs_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "bulk_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_contatos: {
        Row: {
          ativo: boolean
          canal: string
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          metadata: Json
          nome: string
          notas: string | null
          opt_in_status: string
          origem: string
          status_validacao: string
          tags: string[]
          telefone: string | null
          telefone_mask: string | null
          total_entregues: number
          total_enviados: number
          total_lidos: number
          ultima_interacao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          metadata?: Json
          nome: string
          notas?: string | null
          opt_in_status?: string
          origem?: string
          status_validacao?: string
          tags?: string[]
          telefone?: string | null
          telefone_mask?: string | null
          total_entregues?: number
          total_enviados?: number
          total_lidos?: number
          ultima_interacao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          metadata?: Json
          nome?: string
          notas?: string | null
          opt_in_status?: string
          origem?: string
          status_validacao?: string
          tags?: string[]
          telefone?: string | null
          telefone_mask?: string | null
          total_entregues?: number
          total_enviados?: number
          total_lidos?: number
          ultima_interacao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_disparos: {
        Row: {
          aberto_em: string | null
          campanha_id: string
          canal: string
          contato_id: string | null
          created_at: string
          delivery_reason: string | null
          delivery_status: string | null
          email: string | null
          entregue_em: string | null
          enviado_em: string | null
          erro: string | null
          evento_log: Json
          id: string
          lido_em: string | null
          message_id: string | null
          meta: Json
          nome: string | null
          numero_id: string | null
          proxima_tentativa_em: string | null
          status: string
          telefone: string | null
          tentativas: number
          ultimo_erro_codigo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aberto_em?: string | null
          campanha_id: string
          canal?: string
          contato_id?: string | null
          created_at?: string
          delivery_reason?: string | null
          delivery_status?: string | null
          email?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro?: string | null
          evento_log?: Json
          id?: string
          lido_em?: string | null
          message_id?: string | null
          meta?: Json
          nome?: string | null
          numero_id?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          telefone?: string | null
          tentativas?: number
          ultimo_erro_codigo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aberto_em?: string | null
          campanha_id?: string
          canal?: string
          contato_id?: string | null
          created_at?: string
          delivery_reason?: string | null
          delivery_status?: string | null
          email?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro?: string | null
          evento_log?: Json
          id?: string
          lido_em?: string | null
          message_id?: string | null
          meta?: Json
          nome?: string | null
          numero_id?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          telefone?: string | null
          tentativas?: number
          ultimo_erro_codigo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_disparos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "bulk_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_disparos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "bulk_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_email_templates: {
        Row: {
          assunto: string | null
          corpo_html: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto?: string | null
          corpo_html?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string | null
          corpo_html?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_engine_logs: {
        Row: {
          campanha_id: string | null
          categoria: string
          created_at: string
          id: string
          mensagem: string
          meta: Json
          nivel: string
          numero_id: string | null
          user_id: string | null
        }
        Insert: {
          campanha_id?: string | null
          categoria?: string
          created_at?: string
          id?: string
          mensagem: string
          meta?: Json
          nivel?: string
          numero_id?: string | null
          user_id?: string | null
        }
        Update: {
          campanha_id?: string | null
          categoria?: string
          created_at?: string
          id?: string
          mensagem?: string
          meta?: Json
          nivel?: string
          numero_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bulk_feriados: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
          pausa_total: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          pausa_total?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          pausa_total?: boolean
          user_id?: string
        }
        Relationships: []
      }
      bulk_form_campaigns: {
        Row: {
          campanha_id: string
          created_at: string
          expira_em: string | null
          id: string
          mensagem_template: string | null
          template_id: string
          updated_at: string
          veiculo_envio: string
        }
        Insert: {
          campanha_id: string
          created_at?: string
          expira_em?: string | null
          id?: string
          mensagem_template?: string | null
          template_id: string
          updated_at?: string
          veiculo_envio?: string
        }
        Update: {
          campanha_id?: string
          created_at?: string
          expira_em?: string | null
          id?: string
          mensagem_template?: string | null
          template_id?: string
          updated_at?: string
          veiculo_envio?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_form_campaigns_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: true
            referencedRelation: "bulk_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_form_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bulk_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_form_links: {
        Row: {
          aberto_em: string | null
          bloco: string | null
          campanha_id: string
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          empreendimento_id: string | null
          empreendimento_nome: string | null
          empresa: string | null
          form_campaign_id: string
          id: string
          ip: string | null
          pdf_final_path: string | null
          respondido_em: string | null
          status: string
          template_vars: Json | null
          token: string
          unidade: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          aberto_em?: string | null
          bloco?: string | null
          campanha_id: string
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          empresa?: string | null
          form_campaign_id: string
          id?: string
          ip?: string | null
          pdf_final_path?: string | null
          respondido_em?: string | null
          status?: string
          template_vars?: Json | null
          token: string
          unidade?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          aberto_em?: string | null
          bloco?: string | null
          campanha_id?: string
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          empresa?: string | null
          form_campaign_id?: string
          id?: string
          ip?: string | null
          pdf_final_path?: string | null
          respondido_em?: string | null
          status?: string
          template_vars?: Json | null
          token?: string
          unidade?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_form_links_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "bulk_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_form_links_form_campaign_id_fkey"
            columns: ["form_campaign_id"]
            isOneToOne: false
            referencedRelation: "bulk_form_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_form_responses: {
        Row: {
          assinatura_path: string | null
          created_at: string
          id: string
          link_id: string
          parcial: boolean
          payload: Json
          updated_at: string
        }
        Insert: {
          assinatura_path?: string | null
          created_at?: string
          id?: string
          link_id: string
          parcial?: boolean
          payload?: Json
          updated_at?: string
        }
        Update: {
          assinatura_path?: string | null
          created_at?: string
          id?: string
          link_id?: string
          parcial?: boolean
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_form_responses_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "bulk_form_links"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_form_templates: {
        Row: {
          arquivo_modelo_mime: string | null
          arquivo_modelo_nome: string | null
          arquivo_modelo_path: string | null
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          schema_campos: Json
          updated_at: string
        }
        Insert: {
          arquivo_modelo_mime?: string | null
          arquivo_modelo_nome?: string | null
          arquivo_modelo_path?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          schema_campos?: Json
          updated_at?: string
        }
        Update: {
          arquivo_modelo_mime?: string | null
          arquivo_modelo_nome?: string | null
          arquivo_modelo_path?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          schema_campos?: Json
          updated_at?: string
        }
        Relationships: []
      }
      bulk_integracoes_nativas: {
        Row: {
          ativo: boolean
          created_at: string
          eventos: string[]
          headers_extras: Json
          id: string
          mapeamento_campos: Json
          nome: string
          tipo: string
          total_disparos: number
          ultimo_disparo_em: string | null
          updated_at: string
          user_id: string
          webhook_url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          headers_extras?: Json
          id?: string
          mapeamento_campos?: Json
          nome: string
          tipo: string
          total_disparos?: number
          ultimo_disparo_em?: string | null
          updated_at?: string
          user_id: string
          webhook_url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          headers_extras?: Json
          id?: string
          mapeamento_campos?: Json
          nome?: string
          tipo?: string
          total_disparos?: number
          ultimo_disparo_em?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      bulk_mensagens_recebidas: {
        Row: {
          campanha_id: string | null
          conteudo_texto: string | null
          created_at: string
          disparo_id: string | null
          from_number: string
          id: string
          message_id: string | null
          provedor: string
          raw_payload: Json | null
          recebido_em: string
          tipo_conteudo: string | null
          to_number: string | null
          user_id: string
          webhook_id: string | null
        }
        Insert: {
          campanha_id?: string | null
          conteudo_texto?: string | null
          created_at?: string
          disparo_id?: string | null
          from_number: string
          id?: string
          message_id?: string | null
          provedor?: string
          raw_payload?: Json | null
          recebido_em?: string
          tipo_conteudo?: string | null
          to_number?: string | null
          user_id: string
          webhook_id?: string | null
        }
        Update: {
          campanha_id?: string | null
          conteudo_texto?: string | null
          created_at?: string
          disparo_id?: string | null
          from_number?: string
          id?: string
          message_id?: string | null
          provedor?: string
          raw_payload?: Json | null
          recebido_em?: string
          tipo_conteudo?: string | null
          to_number?: string | null
          user_id?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_mensagens_recebidas_disparo_id_fkey"
            columns: ["disparo_id"]
            isOneToOne: false
            referencedRelation: "bulk_disparos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_mensagens_recebidas_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "bulk_webhooks_inbound"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_opt_outs: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          origem: string
          telefone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          origem?: string
          telefone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          origem?: string
          telefone?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_otimizador_horarios: {
        Row: {
          amostra: number
          contato_id: string
          hora: number
          taxa_leitura: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amostra?: number
          contato_id: string
          hora: number
          taxa_leitura?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amostra?: number
          contato_id?: string
          hora?: number
          taxa_leitura?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_segmento_contatos: {
        Row: {
          contato_id: string
          created_at: string
          id: string
          segmento_id: string
          user_id: string
        }
        Insert: {
          contato_id: string
          created_at?: string
          id?: string
          segmento_id: string
          user_id: string
        }
        Update: {
          contato_id?: string
          created_at?: string
          id?: string
          segmento_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_segmento_contatos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "bulk_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_segmento_contatos_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "bulk_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_segmentos: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          regras: Json
          total_contatos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          regras?: Json
          total_contatos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          regras?: Json
          total_contatos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_webhook_logs: {
        Row: {
          created_at: string
          direcao: string
          erro: string | null
          evento: string | null
          id: string
          latencia_ms: number | null
          payload_enviado: Json | null
          payload_recebido: Json | null
          response_body: string | null
          response_status: number | null
          sucesso: boolean
          tentativa: number
          user_id: string | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string
          direcao: string
          erro?: string | null
          evento?: string | null
          id?: string
          latencia_ms?: number | null
          payload_enviado?: Json | null
          payload_recebido?: Json | null
          response_body?: string | null
          response_status?: number | null
          sucesso?: boolean
          tentativa?: number
          user_id?: string | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string
          direcao?: string
          erro?: string | null
          evento?: string | null
          id?: string
          latencia_ms?: number | null
          payload_enviado?: Json | null
          payload_recebido?: Json | null
          response_body?: string | null
          response_status?: number | null
          sucesso?: boolean
          tentativa?: number
          user_id?: string | null
          webhook_id?: string | null
        }
        Relationships: []
      }
      bulk_webhook_outbound_queue: {
        Row: {
          created_at: string
          evento: string
          id: string
          max_tentativas: number
          outbound_id: string
          payload: Json
          proxima_tentativa_em: string
          status: string
          tentativas: number
          ultimo_erro: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evento: string
          id?: string
          max_tentativas?: number
          outbound_id: string
          payload: Json
          proxima_tentativa_em?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          evento?: string
          id?: string
          max_tentativas?: number
          outbound_id?: string
          payload?: Json
          proxima_tentativa_em?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_webhooks_inbound: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          endpoint_path: string
          id: string
          provedor: string
          secret_token: string | null
          total_recebidos: number
          ultimo_evento_em: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          endpoint_path: string
          id?: string
          provedor: string
          secret_token?: string | null
          total_recebidos?: number
          ultimo_evento_em?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          endpoint_path?: string
          id?: string
          provedor?: string
          secret_token?: string | null
          total_recebidos?: number
          ultimo_evento_em?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_webhooks_outbound: {
        Row: {
          ativo: boolean
          created_at: string
          eventos: string[]
          headers_extras: Json
          id: string
          nome: string
          secret: string | null
          total_disparados: number
          total_falhas: number
          ultimo_disparo_em: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          headers_extras?: Json
          id?: string
          nome: string
          secret?: string | null
          total_disparados?: number
          total_falhas?: number
          ultimo_disparo_em?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          headers_extras?: Json
          id?: string
          nome?: string
          secret?: string | null
          total_disparados?: number
          total_falhas?: number
          ultimo_disparo_em?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      campanha_assinatura_logs: {
        Row: {
          assinatura_id: string
          ator: string | null
          categoria: string
          created_at: string
          evento: string
          id: string
          mensagem: string | null
          payload: Json
        }
        Insert: {
          assinatura_id: string
          ator?: string | null
          categoria: string
          created_at?: string
          evento: string
          id?: string
          mensagem?: string | null
          payload?: Json
        }
        Update: {
          assinatura_id?: string
          ator?: string | null
          categoria?: string
          created_at?: string
          evento?: string
          id?: string
          mensagem?: string | null
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campanha_assinatura_logs_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "campanha_assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanha_assinaturas: {
        Row: {
          assinado_em: string | null
          bloco: string | null
          campanha_id: string
          canal: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          destinatario_id: string | null
          empreendimento_id: string | null
          empreendimento_nome: string | null
          enviado_em: string | null
          formulario: Json
          id: string
          origem_resposta: string
          pdf_path: string | null
          recusado_em: string | null
          status: string
          tae_metadata: Json | null
          tae_status: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          assinado_em?: string | null
          bloco?: string | null
          campanha_id: string
          canal?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          destinatario_id?: string | null
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          enviado_em?: string | null
          formulario?: Json
          id?: string
          origem_resposta?: string
          pdf_path?: string | null
          recusado_em?: string | null
          status?: string
          tae_metadata?: Json | null
          tae_status?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          assinado_em?: string | null
          bloco?: string | null
          campanha_id?: string
          canal?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          destinatario_id?: string | null
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          enviado_em?: string | null
          formulario?: Json
          id?: string
          origem_resposta?: string
          pdf_path?: string | null
          recusado_em?: string | null
          status?: string
          tae_metadata?: Json | null
          tae_status?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanha_assinaturas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "bulk_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_assinaturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_assinaturas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          ativo: boolean
          cbo: string | null
          criado_em: string
          id: string
          nome: string
          organizacao_id: string
        }
        Insert: {
          ativo?: boolean
          cbo?: string | null
          criado_em?: string
          id?: string
          nome: string
          organizacao_id: string
        }
        Update: {
          ativo?: boolean
          cbo?: string | null
          criado_em?: string
          id?: string
          nome?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_otp_whatsapp: {
        Row: {
          attempts: number
          codigo_hash: string
          consumed_at: string | null
          cpf: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          senha_temp_hash: string | null
          telefone_full: string | null
          telefone_mask: string | null
        }
        Insert: {
          attempts?: number
          codigo_hash: string
          consumed_at?: string | null
          cpf: string
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          senha_temp_hash?: string | null
          telefone_full?: string | null
          telefone_mask?: string | null
        }
        Update: {
          attempts?: number
          codigo_hash?: string
          consumed_at?: string | null
          cpf?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          senha_temp_hash?: string | null
          telefone_full?: string | null
          telefone_mask?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          bloco: string | null
          cpf: string | null
          created_at: string
          email: string | null
          empreendimento_id: string | null
          id: string
          nome_completo: string
          telefone: string | null
          unidade: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          bloco?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empreendimento_id?: string | null
          id?: string
          nome_completo: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          bloco?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empreendimento_id?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_totvs_cache: {
        Row: {
          cpf: string
          created_at: string
          email: string | null
          hit_count: number
          last_synced_at: string
          nome: string
          payload: Json | null
          source: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          email?: string | null
          hit_count?: number
          last_synced_at?: string
          nome: string
          payload?: Json | null
          source?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string | null
          hit_count?: number
          last_synced_at?: string
          nome?: string
          payload?: Json | null
          source?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crc_cockpit_cache: {
        Row: {
          bloco: string
          codigo_empreendimento: string
          cpf: string
          created_at: string
          created_by: string | null
          expires_at: string
          fetched_at: string
          id: string
          payload: Json
          source: string
          tipo: string
          unidade: string
          updated_at: string
        }
        Insert: {
          bloco?: string
          codigo_empreendimento?: string
          cpf: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          fetched_at?: string
          id?: string
          payload: Json
          source?: string
          tipo: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          bloco?: string
          codigo_empreendimento?: string
          cpf?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          fetched_at?: string
          id?: string
          payload?: Json
          source?: string
          tipo?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_tickets: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          project_id: string
          resolved_at: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          project_id: string
          resolved_at?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          project_id?: string
          resolved_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "nina_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "nina_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean
          codigo: string | null
          criado_em: string
          id: string
          nome: string
          organizacao_id: string
          posto_trabalho_id: string | null
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          criado_em?: string
          id?: string
          nome: string
          organizacao_id: string
          posto_trabalho_id?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          criado_em?: string
          id?: string
          nome?: string
          organizacao_id?: string
          posto_trabalho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_posto_trabalho_id_fkey"
            columns: ["posto_trabalho_id"]
            isOneToOne: false
            referencedRelation: "postos_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      docusign_config: {
        Row: {
          access_token_cache: string | null
          access_token_expira_em: string | null
          account_id: string | null
          ambiente: string
          ativo: boolean
          auth_url: string
          base_url: string
          default_template_id: string | null
          id: string
          impersonated_user_id: string | null
          integration_key: string | null
          rsa_private_key: string | null
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token_cache?: string | null
          access_token_expira_em?: string | null
          account_id?: string | null
          ambiente?: string
          ativo?: boolean
          auth_url?: string
          base_url?: string
          default_template_id?: string | null
          id?: string
          impersonated_user_id?: string | null
          integration_key?: string | null
          rsa_private_key?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token_cache?: string | null
          access_token_expira_em?: string | null
          account_id?: string | null
          ambiente?: string
          ativo?: boolean
          auth_url?: string
          base_url?: string
          default_template_id?: string | null
          id?: string
          impersonated_user_id?: string | null
          integration_key?: string | null
          rsa_private_key?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      docusign_envelopes: {
        Row: {
          campanha_id: string | null
          completed_at: string | null
          created_at: string
          declined_at: string | null
          destinatario_id: string | null
          envelope_id: string
          id: string
          last_event_at: string | null
          raw: Json | null
          sent_at: string | null
          status: string | null
          template_id: string | null
          voided_at: string | null
        }
        Insert: {
          campanha_id?: string | null
          completed_at?: string | null
          created_at?: string
          declined_at?: string | null
          destinatario_id?: string | null
          envelope_id: string
          id?: string
          last_event_at?: string | null
          raw?: Json | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          voided_at?: string | null
        }
        Update: {
          campanha_id?: string | null
          completed_at?: string | null
          created_at?: string
          declined_at?: string | null
          destinatario_id?: string | null
          envelope_id?: string
          id?: string
          last_event_at?: string | null
          raw?: Json | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          voided_at?: string | null
        }
        Relationships: []
      }
      empreendimentos: {
        Row: {
          ativo: boolean
          blocos: Json
          cidade: string | null
          codigo_totvs: string | null
          created_at: string
          empresa_id: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          blocos?: Json
          cidade?: string | null
          codigo_totvs?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          blocos?: Json
          cidade?: string | null
          codigo_totvs?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empreendimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empreendimentos_cache: {
        Row: {
          atualizado_em: string
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string | null
          link: string | null
          ordem: number | null
          slug: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link?: string | null
          ordem?: number | null
          slug: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link?: string | null
          ordem?: number | null
          slug?: string
          titulo?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome_fantasia: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipe_membros: {
        Row: {
          ativo: boolean
          created_at: string
          equipe_id: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          equipe_id: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          equipe_id?: string
          id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membros_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_tipos_atendimento: {
        Row: {
          created_at: string
          equipe_id: string
          id: string
          tipo_atendimento_id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          id?: string
          tipo_atendimento_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          id?: string
          tipo_atendimento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_tipos_atendimento_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_tipos_atendimento_tipo_atendimento_id_fkey"
            columns: ["tipo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          modulo: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      extrato_links: {
        Row: {
          canal: string
          created_at: string
          email_destinatario: string | null
          expires_at: string
          last_viewed_at: string | null
          max_views: number
          storage_path: string
          telefone_destinatario: string | null
          token: string
          user_id: string
          views: number
        }
        Insert: {
          canal: string
          created_at?: string
          email_destinatario?: string | null
          expires_at?: string
          last_viewed_at?: string | null
          max_views?: number
          storage_path: string
          telefone_destinatario?: string | null
          token?: string
          user_id: string
          views?: number
        }
        Update: {
          canal?: string
          created_at?: string
          email_destinatario?: string | null
          expires_at?: string
          last_viewed_at?: string | null
          max_views?: number
          storage_path?: string
          telefone_destinatario?: string | null
          token?: string
          user_id?: string
          views?: number
        }
        Relationships: []
      }
      ficha_financeira_logs: {
        Row: {
          bloco: string | null
          codcoligada: string | null
          codempreendimento: string | null
          cpf: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          http_status: number | null
          id: string
          rows_count: number | null
          status: string
          unidade: string | null
          user_id: string | null
        }
        Insert: {
          bloco?: string | null
          codcoligada?: string | null
          codempreendimento?: string | null
          cpf?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          rows_count?: number | null
          status: string
          unidade?: string | null
          user_id?: string | null
        }
        Update: {
          bloco?: string | null
          codcoligada?: string | null
          codempreendimento?: string | null
          cpf?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          rows_count?: number | null
          status?: string
          unidade?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fotos_referencia: {
        Row: {
          criado_em: string
          id: string
          pessoa_id: string
          storage_path: string
        }
        Insert: {
          criado_em?: string
          id?: string
          pessoa_id: string
          storage_path: string
        }
        Update: {
          criado_em?: string
          id?: string
          pessoa_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_referencia_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_call_log: {
        Row: {
          api_id: string | null
          api_name: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          http_status: number | null
          id: string
          kind: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          api_id?: string | null
          api_name?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          kind: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          user_id?: string | null
        }
        Update: {
          api_id?: string | null
          api_name?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          kind?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      grupos_terminais: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          organizacao_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          organizacao_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_terminais_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_porcelanato_eventos: {
        Row: {
          created_at: string
          evento: string
          id: string
          ip: string | null
          payload: Json | null
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          evento: string
          id?: string
          ip?: string | null
          payload?: Json | null
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          evento?: string
          id?: string
          ip?: string | null
          payload?: Json | null
          token?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      kit_porcelanato_links: {
        Row: {
          bloco: string
          campanha_id: string | null
          created_at: string
          disparo_id: string | null
          expires_at: string
          id: string
          nome: string
          telefone: string | null
          token: string
          unidade: string
        }
        Insert: {
          bloco: string
          campanha_id?: string | null
          created_at?: string
          disparo_id?: string | null
          expires_at?: string
          id?: string
          nome: string
          telefone?: string | null
          token: string
          unidade: string
        }
        Update: {
          bloco?: string
          campanha_id?: string | null
          created_at?: string
          disparo_id?: string | null
          expires_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          token?: string
          unidade?: string
        }
        Relationships: []
      }
      kit_porcelanato_modelo: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          id: string
          pdf_nome_original: string
          pdf_path: string
          total_paginas: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          pdf_nome_original: string
          pdf_path: string
          total_paginas?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          pdf_nome_original?: string
          pdf_path?: string
          total_paginas?: number | null
        }
        Relationships: []
      }
      kit_porcelanato_respostas: {
        Row: {
          bloco: string
          contratacao_kit: boolean
          created_at: string
          data_resposta: string
          id: string
          justificativa_manual: string | null
          nome_comprador: string
          origem: string
          pdf_gerado: boolean
          registrado_por: string | null
          tipo_porcelanato: string | null
          unidade: string
        }
        Insert: {
          bloco: string
          contratacao_kit: boolean
          created_at?: string
          data_resposta?: string
          id?: string
          justificativa_manual?: string | null
          nome_comprador: string
          origem?: string
          pdf_gerado?: boolean
          registrado_por?: string | null
          tipo_porcelanato?: string | null
          unidade: string
        }
        Update: {
          bloco?: string
          contratacao_kit?: boolean
          created_at?: string
          data_resposta?: string
          id?: string
          justificativa_manual?: string | null
          nome_comprador?: string
          origem?: string
          pdf_gerado?: boolean
          registrado_por?: string | null
          tipo_porcelanato?: string | null
          unidade?: string
        }
        Relationships: []
      }
      knowledge_base_documents: {
        Row: {
          content: string | null
          created_at: string
          document_type: string | null
          file_path: string | null
          id: string
          project_id: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          id?: string
          project_id: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "nina_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      log_auditoria: {
        Row: {
          acao: string
          criado_em: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          entidade: string
          id: number
          ip: string | null
          organizacao_id: string
          registro_id: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade: string
          id?: number
          ip?: string | null
          organizacao_id: string
          registro_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade?: string
          id?: number
          ip?: string | null
          organizacao_id?: string
          registro_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_auditoria_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          parent_key: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          parent_key?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          parent_key?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      nina_clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_interaction: string | null
          phone_number: string | null
          project_id: string
          status_erp: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          last_interaction?: string | null
          phone_number?: string | null
          project_id: string
          status_erp?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_interaction?: string | null
          phone_number?: string | null
          project_id?: string
          status_erp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nina_clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "nina_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      nina_projects: {
        Row: {
          api_keys: Json | null
          company_name: string | null
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
        }
        Insert: {
          api_keys?: Json | null
          company_name?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
        }
        Update: {
          api_keys?: Json | null
          company_name?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      organizacoes: {
        Row: {
          cnpj: string
          criado_em: string
          id: string
          razao_social: string
        }
        Insert: {
          cnpj: string
          criado_em?: string
          id?: string
          razao_social: string
        }
        Update: {
          cnpj?: string
          criado_em?: string
          id?: string
          razao_social?: string
        }
        Relationships: []
      }
      parametros_organizacao: {
        Row: {
          atualizado_em: string
          fuso_horario: string
          intervalo_min_passagens: number
          limiar_confianca_facial: number
          organizacao_id: string
          retencao_imagens_meses: number
          tolerancia_atraso_min: number
        }
        Insert: {
          atualizado_em?: string
          fuso_horario?: string
          intervalo_min_passagens?: number
          limiar_confianca_facial?: number
          organizacao_id: string
          retencao_imagens_meses?: number
          tolerancia_atraso_min?: number
        }
        Update: {
          atualizado_em?: string
          fuso_horario?: string
          intervalo_min_passagens?: number
          limiar_confianca_facial?: number
          organizacao_id?: string
          retencao_imagens_meses?: number
          tolerancia_atraso_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "parametros_organizacao_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: true
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cargo_id: string | null
          consentimento_lgpd: boolean
          cpf: string
          criado_em: string
          data_admissao: string | null
          data_consentimento: string | null
          data_inclusao: string
          data_nascimento: string | null
          data_reativacao: string | null
          departamento_id: string | null
          email: string | null
          face_id: string | null
          id: string
          matricula: string | null
          nome: string
          numero_cracha: string | null
          organizacao_id: string
          pis: string | null
          posto_trabalho_id: string | null
          rg: string | null
          telefone: string | null
          tipo_pessoa: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cargo_id?: string | null
          consentimento_lgpd?: boolean
          cpf: string
          criado_em?: string
          data_admissao?: string | null
          data_consentimento?: string | null
          data_inclusao?: string
          data_nascimento?: string | null
          data_reativacao?: string | null
          departamento_id?: string | null
          email?: string | null
          face_id?: string | null
          id?: string
          matricula?: string | null
          nome: string
          numero_cracha?: string | null
          organizacao_id: string
          pis?: string | null
          posto_trabalho_id?: string | null
          rg?: string | null
          telefone?: string | null
          tipo_pessoa?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cargo_id?: string | null
          consentimento_lgpd?: boolean
          cpf?: string
          criado_em?: string
          data_admissao?: string | null
          data_consentimento?: string | null
          data_inclusao?: string
          data_nascimento?: string | null
          data_reativacao?: string | null
          departamento_id?: string | null
          email?: string | null
          face_id?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          numero_cracha?: string | null
          organizacao_id?: string
          pis?: string | null
          posto_trabalho_id?: string | null
          rg?: string | null
          telefone?: string | null
          tipo_pessoa?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_posto_trabalho_id_fkey"
            columns: ["posto_trabalho_id"]
            isOneToOne: false
            referencedRelation: "postos_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      postos_trabalho: {
        Row: {
          ativo: boolean
          cidade: string | null
          codigo: string | null
          criado_em: string
          endereco: string | null
          id: string
          nome: string
          organizacao_id: string
          uf: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          codigo?: string | null
          criado_em?: string
          endereco?: string | null
          id?: string
          nome: string
          organizacao_id: string
          uf?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          codigo?: string | null
          criado_em?: string
          endereco?: string | null
          id?: string
          nome?: string
          organizacao_id?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postos_trabalho_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_menu_permissions: {
        Row: {
          can_view: boolean
          created_at: string
          id: string
          menu_key: string
          profile_key: string
          updated_at: string
        }
        Insert: {
          can_view?: boolean
          created_at?: string
          id?: string
          menu_key: string
          profile_key: string
          updated_at?: string
        }
        Update: {
          can_view?: boolean
          created_at?: string
          id?: string
          menu_key?: string
          profile_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_menu_permissions_menu_key_fkey"
            columns: ["menu_key"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "profile_menu_permissions_profile_key_fkey"
            columns: ["profile_key"]
            isOneToOne: false
            referencedRelation: "app_profiles"
            referencedColumns: ["key"]
          },
        ]
      }
      profiles: {
        Row: {
          app_profile_key: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          telefone: string | null
          totvs_synced_at: string | null
          updated_at: string
        }
        Insert: {
          app_profile_key?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          telefone?: string | null
          totvs_synced_at?: string | null
          updated_at?: string
        }
        Update: {
          app_profile_key?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          telefone?: string | null
          totvs_synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recebiveis: {
        Row: {
          bloco_nome: string | null
          cliente_nome: string | null
          created_at: string
          data_vencimento: string
          empreendimento_nome: string
          id: string
          id_externo_totvs: string
          projeto_id: string | null
          status_parcela: string | null
          ultima_sincronizacao: string | null
          unidade_nome: string | null
          updated_at: string
          valor_parcela: number
        }
        Insert: {
          bloco_nome?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_vencimento: string
          empreendimento_nome: string
          id?: string
          id_externo_totvs: string
          projeto_id?: string | null
          status_parcela?: string | null
          ultima_sincronizacao?: string | null
          unidade_nome?: string | null
          updated_at?: string
          valor_parcela: number
        }
        Update: {
          bloco_nome?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_vencimento?: string
          empreendimento_nome?: string
          id?: string
          id_externo_totvs?: string
          projeto_id?: string | null
          status_parcela?: string | null
          ultima_sincronizacao?: string | null
          unidade_nome?: string | null
          updated_at?: string
          valor_parcela?: number
        }
        Relationships: []
      }
      registros_ponto: {
        Row: {
          criado_em: string
          data_hora: string
          foto_auditoria_path: string | null
          id: string
          organizacao_id: string
          origem: string
          pessoa_id: string
          score_confianca: number | null
          terminal_id: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          data_hora: string
          foto_auditoria_path?: string | null
          id?: string
          organizacao_id: string
          origem?: string
          pessoa_id: string
          score_confianca?: number | null
          terminal_id?: string | null
          tipo: string
        }
        Update: {
          criado_em?: string
          data_hora?: string
          foto_auditoria_path?: string | null
          id?: string
          organizacao_id?: string
          origem?: string
          pessoa_id?: string
          score_confianca?: number | null
          terminal_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminais"
            referencedColumns: ["id"]
          },
        ]
      }
      soap_envelope_templates: {
        Row: {
          action: string
          created_at: string
          description: string | null
          envelope_xml: string
          id: string
          key: string
          response_path: string | null
          service: string
          updated_at: string
          version: number
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          envelope_xml: string
          id?: string
          key: string
          response_path?: string | null
          service: string
          updated_at?: string
          version?: number
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          envelope_xml?: string
          id?: string
          key?: string
          response_path?: string | null
          service?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          erro_mensagem: string | null
          id: string
          modulo: string
          registros_processados: number | null
          status: string | null
          step: string | null
          tipo_sync: string
          type: string | null
        }
        Insert: {
          data_fim?: string | null
          data_inicio?: string | null
          erro_mensagem?: string | null
          id?: string
          modulo: string
          registros_processados?: number | null
          status?: string | null
          step?: string | null
          tipo_sync: string
          type?: string | null
        }
        Update: {
          data_fim?: string | null
          data_inicio?: string | null
          erro_mensagem?: string | null
          id?: string
          modulo?: string
          registros_processados?: number | null
          status?: string | null
          step?: string | null
          tipo_sync?: string
          type?: string | null
        }
        Relationships: []
      }
      tae_integration_settings: {
        Row: {
          acao_assinar: number
          acao_assinatura_automatica: number
          acao_visualizar: number
          api_url: string
          assunto_padrao: string | null
          auth_url: string
          auto_sign_sender: boolean
          auto_update_status: boolean
          cc_email: string | null
          created_at: string
          created_by: string | null
          dias_expiracao: number
          id: string
          is_active: boolean
          lembretes_ativos: boolean
          mensagem_padrao: string | null
          metadata: Json
          name: string
          papel_id_observador: number
          papel_id_signatario: number
          sender_cpf: string | null
          sender_email: string | null
          sender_name: string | null
          sender_password: string | null
          service_password: string
          service_user: string
          tae_sync_last_run_at: string | null
          tae_sync_total: number
          updated_at: string
          web_login_url: string
          webhook_last_event_at: string | null
          webhook_secret: string | null
          webhook_total_recebidos: number
        }
        Insert: {
          acao_assinar?: number
          acao_assinatura_automatica?: number
          acao_visualizar?: number
          api_url?: string
          assunto_padrao?: string | null
          auth_url?: string
          auto_sign_sender?: boolean
          auto_update_status?: boolean
          cc_email?: string | null
          created_at?: string
          created_by?: string | null
          dias_expiracao?: number
          id?: string
          is_active?: boolean
          lembretes_ativos?: boolean
          mensagem_padrao?: string | null
          metadata?: Json
          name?: string
          papel_id_observador?: number
          papel_id_signatario?: number
          sender_cpf?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_password?: string | null
          service_password?: string
          service_user?: string
          tae_sync_last_run_at?: string | null
          tae_sync_total?: number
          updated_at?: string
          web_login_url?: string
          webhook_last_event_at?: string | null
          webhook_secret?: string | null
          webhook_total_recebidos?: number
        }
        Update: {
          acao_assinar?: number
          acao_assinatura_automatica?: number
          acao_visualizar?: number
          api_url?: string
          assunto_padrao?: string | null
          auth_url?: string
          auto_sign_sender?: boolean
          auto_update_status?: boolean
          cc_email?: string | null
          created_at?: string
          created_by?: string | null
          dias_expiracao?: number
          id?: string
          is_active?: boolean
          lembretes_ativos?: boolean
          mensagem_padrao?: string | null
          metadata?: Json
          name?: string
          papel_id_observador?: number
          papel_id_signatario?: number
          sender_cpf?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_password?: string | null
          service_password?: string
          service_user?: string
          tae_sync_last_run_at?: string | null
          tae_sync_total?: number
          updated_at?: string
          web_login_url?: string
          webhook_last_event_at?: string | null
          webhook_secret?: string | null
          webhook_total_recebidos?: number
        }
        Relationships: []
      }
      tae_webhook_subscriptions: {
        Row: {
          ativo: boolean
          body_params: Json
          created_at: string
          created_by: string | null
          custom_headers: Json
          evento: string
          id: string
          nome: string
          retentativas: number
          timeout_segundos: number
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          body_params?: Json
          created_at?: string
          created_by?: string | null
          custom_headers?: Json
          evento: string
          id?: string
          nome: string
          retentativas?: number
          timeout_segundos?: number
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          body_params?: Json
          created_at?: string
          created_by?: string | null
          custom_headers?: Json
          evento?: string
          id?: string
          nome?: string
          retentativas?: number
          timeout_segundos?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      tecnico_horarios: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          equipe_id: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          equipe_id?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          equipe_id?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tecnico_horarios_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      tecnico_indisponibilidades: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          motivo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          motivo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          motivo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      terminais: {
        Row: {
          apelido: string
          grupo_id: string | null
          id: string
          ip_local: string | null
          numero_serie: string
          organizacao_id: string
          porta: number | null
          posto_trabalho_id: string | null
          protocolo: string | null
          registrado_em: string
          responsavel: string | null
          sentido: string
          situacao: string
          tipo: string
          ultima_sincronizacao: string | null
        }
        Insert: {
          apelido: string
          grupo_id?: string | null
          id?: string
          ip_local?: string | null
          numero_serie: string
          organizacao_id: string
          porta?: number | null
          posto_trabalho_id?: string | null
          protocolo?: string | null
          registrado_em?: string
          responsavel?: string | null
          sentido?: string
          situacao?: string
          tipo: string
          ultima_sincronizacao?: string | null
        }
        Update: {
          apelido?: string
          grupo_id?: string | null
          id?: string
          ip_local?: string | null
          numero_serie?: string
          organizacao_id?: string
          porta?: number | null
          posto_trabalho_id?: string | null
          protocolo?: string | null
          registrado_em?: string
          responsavel?: string | null
          sentido?: string
          situacao?: string
          tipo?: string
          ultima_sincronizacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminais_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_terminais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminais_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminais_posto_trabalho_id_fkey"
            columns: ["posto_trabalho_id"]
            isOneToOne: false
            referencedRelation: "postos_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_evento_horarios: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          slot_minutos: number
          tipo_id: string
          vagas_por_slot: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          slot_minutos?: number
          tipo_id: string
          vagas_por_slot?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          slot_minutos?: number
          tipo_id?: string
          vagas_por_slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "tipo_evento_horarios_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_evento_slot_config: {
        Row: {
          created_at: string
          duracao_minutos: number | null
          id: string
          intervalo_minutos: number
          max_atendimentos_dia: number | null
          tipo_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duracao_minutos?: number | null
          id?: string
          intervalo_minutos?: number
          max_atendimentos_dia?: number | null
          tipo_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duracao_minutos?: number | null
          id?: string
          intervalo_minutos?: number
          max_atendimentos_dia?: number | null
          tipo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipo_evento_slot_config_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: true
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_evento_slot_config_data: {
        Row: {
          bloqueado: boolean
          created_at: string
          data: string
          duracao_minutos: number | null
          id: string
          intervalo_minutos: number | null
          max_atendimentos_dia: number | null
          observacao: string | null
          slots_disponiveis: Json | null
          tipo_id: string
        }
        Insert: {
          bloqueado?: boolean
          created_at?: string
          data: string
          duracao_minutos?: number | null
          id?: string
          intervalo_minutos?: number | null
          max_atendimentos_dia?: number | null
          observacao?: string | null
          slots_disponiveis?: Json | null
          tipo_id: string
        }
        Update: {
          bloqueado?: boolean
          created_at?: string
          data?: string
          duracao_minutos?: number | null
          id?: string
          intervalo_minutos?: number | null
          max_atendimentos_dia?: number | null
          observacao?: string | null
          slots_disponiveis?: Json | null
          tipo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipo_evento_slot_config_data_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_evento_slot_config_dia: {
        Row: {
          created_at: string
          dia_semana: number
          duracao_minutos: number | null
          id: string
          intervalo_minutos: number | null
          max_atendimentos_dia: number | null
          tipo_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          duracao_minutos?: number | null
          id?: string
          intervalo_minutos?: number | null
          max_atendimentos_dia?: number | null
          tipo_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          duracao_minutos?: number | null
          id?: string
          intervalo_minutos?: number | null
          max_atendimentos_dia?: number | null
          tipo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipo_evento_slot_config_dia_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_atendimento: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          descricao: string | null
          duracao_minutos: number
          icone: string
          id: string
          modulo: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          icone?: string
          id?: string
          modulo?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          icone?: string
          id?: string
          modulo?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      totvs_coligadas: {
        Row: {
          ativo: boolean
          cod_coligada: number
          nome: string
        }
        Insert: {
          ativo?: boolean
          cod_coligada: number
          nome: string
        }
        Update: {
          ativo?: boolean
          cod_coligada?: number
          nome?: string
        }
        Relationships: []
      }
      totvs_config: {
        Row: {
          api_url: string
          auth_type: string
          base_url: string
          branch_id: string
          company_id: string
          compradores_path: string
          created_at: string
          created_by: string | null
          empreendimentos_path: string
          id: string
          is_active: boolean
          password: string | null
          updated_at: string
          updated_by: string | null
          username: string
        }
        Insert: {
          api_url?: string
          auth_type?: string
          base_url?: string
          branch_id?: string
          company_id?: string
          compradores_path?: string
          created_at?: string
          created_by?: string | null
          empreendimentos_path?: string
          id?: string
          is_active?: boolean
          password?: string | null
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Update: {
          api_url?: string
          auth_type?: string
          base_url?: string
          branch_id?: string
          company_id?: string
          compradores_path?: string
          created_at?: string
          created_by?: string | null
          empreendimentos_path?: string
          id?: string
          is_active?: boolean
          password?: string | null
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Relationships: []
      }
      totvs_dados_brutos: {
        Row: {
          cod_coligada: number
          consulta: string
          erro: string | null
          http_status: number | null
          payload: Json | null
          qtd_registros: number | null
          sincronizado_em: string
        }
        Insert: {
          cod_coligada: number
          consulta: string
          erro?: string | null
          http_status?: number | null
          payload?: Json | null
          qtd_registros?: number | null
          sincronizado_em?: string
        }
        Update: {
          cod_coligada?: number
          consulta?: string
          erro?: string | null
          http_status?: number | null
          payload?: Json | null
          qtd_registros?: number | null
          sincronizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "totvs_dados_brutos_cod_coligada_fkey"
            columns: ["cod_coligada"]
            isOneToOne: false
            referencedRelation: "totvs_coligadas"
            referencedColumns: ["cod_coligada"]
          },
        ]
      }
      totvs_integrations: {
        Row: {
          cached_data: Json | null
          client_erp_code: string | null
          created_at: string
          id: string
          last_sync: string | null
          project_id: string
          status: string
        }
        Insert: {
          cached_data?: Json | null
          client_erp_code?: string | null
          created_at?: string
          id?: string
          last_sync?: string | null
          project_id: string
          status?: string
        }
        Update: {
          cached_data?: Json | null
          client_erp_code?: string | null
          created_at?: string
          id?: string
          last_sync?: string | null
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "totvs_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "nina_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      totvs_parcelas: {
        Row: {
          bloco: string | null
          cliente_nome: string | null
          cod_coligada: number
          cod_empreendimento: number | null
          consulta: string
          conta_caixa: string | null
          data_criacao: string | null
          data_venda: string | null
          desconto: number | null
          empreendimento: string | null
          grupo: number | null
          id_venda_az: string | null
          mora: number | null
          multa: number | null
          num_parcela: string | null
          num_venda: number | null
          parcela_numero: number | null
          parcela_total: number | null
          payload: Json
          previsao_baixa: string | null
          ref: string | null
          ref_lancamento: string
          seg_numero: string | null
          sincronizado_em: string
          situacao_parcela: string | null
          status_venda: string | null
          tipo_parcela: string | null
          unidade: string | null
          valor_baixado: number | null
          valor_correcao: number | null
          valor_liquido: number | null
          valor_original: number | null
          valor_parcela: number | null
          vencimento: string | null
        }
        Insert: {
          bloco?: string | null
          cliente_nome?: string | null
          cod_coligada: number
          cod_empreendimento?: number | null
          consulta: string
          conta_caixa?: string | null
          data_criacao?: string | null
          data_venda?: string | null
          desconto?: number | null
          empreendimento?: string | null
          grupo?: number | null
          id_venda_az?: string | null
          mora?: number | null
          multa?: number | null
          num_parcela?: string | null
          num_venda?: number | null
          parcela_numero?: number | null
          parcela_total?: number | null
          payload: Json
          previsao_baixa?: string | null
          ref?: string | null
          ref_lancamento: string
          seg_numero?: string | null
          sincronizado_em?: string
          situacao_parcela?: string | null
          status_venda?: string | null
          tipo_parcela?: string | null
          unidade?: string | null
          valor_baixado?: number | null
          valor_correcao?: number | null
          valor_liquido?: number | null
          valor_original?: number | null
          valor_parcela?: number | null
          vencimento?: string | null
        }
        Update: {
          bloco?: string | null
          cliente_nome?: string | null
          cod_coligada?: number
          cod_empreendimento?: number | null
          consulta?: string
          conta_caixa?: string | null
          data_criacao?: string | null
          data_venda?: string | null
          desconto?: number | null
          empreendimento?: string | null
          grupo?: number | null
          id_venda_az?: string | null
          mora?: number | null
          multa?: number | null
          num_parcela?: string | null
          num_venda?: number | null
          parcela_numero?: number | null
          parcela_total?: number | null
          payload?: Json
          previsao_baixa?: string | null
          ref?: string | null
          ref_lancamento?: string
          seg_numero?: string | null
          sincronizado_em?: string
          situacao_parcela?: string | null
          status_venda?: string | null
          tipo_parcela?: string | null
          unidade?: string | null
          valor_baixado?: number | null
          valor_correcao?: number | null
          valor_liquido?: number | null
          valor_original?: number | null
          valor_parcela?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios_perfil: {
        Row: {
          ativo: boolean
          criado_em: string
          email: string | null
          id: string
          nome: string
          organizacao_id: string
          perfil: string
          postos_permitidos: string[]
          ultimo_acesso: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id: string
          nome: string
          organizacao_id: string
          perfil?: string
          postos_permitidos?: string[]
          ultimo_acesso?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string
          organizacao_id?: string
          perfil?: string
          postos_permitidos?: string[]
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_perfil_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_bloqueio_config: {
        Row: {
          bloqueio_max_horas: number
          bloqueio_minutos: number
          id: boolean
          janela_minutos: number
          max_falhas: number
        }
        Insert: {
          bloqueio_max_horas?: number
          bloqueio_minutos?: number
          id?: boolean
          janela_minutos?: number
          max_falhas?: number
        }
        Update: {
          bloqueio_max_horas?: number
          bloqueio_minutos?: number
          id?: boolean
          janela_minutos?: number
          max_falhas?: number
        }
        Relationships: []
      }
      auth_falhas_por_usuario: {
        Row: {
          bloqueado_ate: string | null
          falhas: number
          ultima_falha_em: string | null
          user_id: string
        }
        Insert: {
          bloqueado_ate?: string | null
          falhas?: number
          ultima_falha_em?: string | null
          user_id: string
        }
        Update: {
          bloqueado_ate?: string | null
          falhas?: number
          ultima_falha_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auth_login_log: {
        Row: {
          created_at: string
          email_norm: string | null
          id: number
          ip: string | null
          origem: string
          resultado: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_norm?: string | null
          id?: number
          ip?: string | null
          origem?: string
          resultado: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_norm?: string | null
          id?: number
          ip?: string | null
          origem?: string
          resultado?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_tentativas: {
        Row: {
          bloqueado_ate: string | null
          bloqueios: number
          chave: string
          falhas: number
          primeira_falha_em: string | null
          ultima_falha_em: string | null
        }
        Insert: {
          bloqueado_ate?: string | null
          bloqueios?: number
          chave: string
          falhas?: number
          primeira_falha_em?: string | null
          ultima_falha_em?: string | null
        }
        Update: {
          bloqueado_ate?: string | null
          bloqueios?: number
          chave?: string
          falhas?: number
          primeira_falha_em?: string | null
          ultima_falha_em?: string | null
        }
        Relationships: []
      }
      wa_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          ip: string | null
          user_agent: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      wa_campanha_destinatarios: {
        Row: {
          anonimizado_em: string | null
          assinado_em: string | null
          bloco: string | null
          campanha_id: string
          cpf: string | null
          created_at: string
          dados_extras: Json
          email: string | null
          empreendimento: string | null
          envelope_docusign_id: string | null
          enviado_em: string | null
          erro_msg: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["wa_destinatario_status"]
          telefone: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          anonimizado_em?: string | null
          assinado_em?: string | null
          bloco?: string | null
          campanha_id: string
          cpf?: string | null
          created_at?: string
          dados_extras?: Json
          email?: string | null
          empreendimento?: string | null
          envelope_docusign_id?: string | null
          enviado_em?: string | null
          erro_msg?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["wa_destinatario_status"]
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          anonimizado_em?: string | null
          assinado_em?: string | null
          bloco?: string | null
          campanha_id?: string
          cpf?: string | null
          created_at?: string
          dados_extras?: Json
          email?: string | null
          empreendimento?: string | null
          envelope_docusign_id?: string | null
          enviado_em?: string | null
          erro_msg?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["wa_destinatario_status"]
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_campanha_destinatarios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "wa_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_campanhas: {
        Row: {
          config_assinatura: Json
          created_at: string
          criado_por: string | null
          filtros_origem: Json
          id: string
          mensagem_whatsapp: string
          modelo_docusign_id: string | null
          modelo_docusign_nome: string | null
          nome: string
          origem: Database["public"]["Enums"]["wa_campanha_origem"]
          status: Database["public"]["Enums"]["wa_campanha_status"]
          totais: Json
          updated_at: string
        }
        Insert: {
          config_assinatura?: Json
          created_at?: string
          criado_por?: string | null
          filtros_origem?: Json
          id?: string
          mensagem_whatsapp?: string
          modelo_docusign_id?: string | null
          modelo_docusign_nome?: string | null
          nome: string
          origem: Database["public"]["Enums"]["wa_campanha_origem"]
          status?: Database["public"]["Enums"]["wa_campanha_status"]
          totais?: Json
          updated_at?: string
        }
        Update: {
          config_assinatura?: Json
          created_at?: string
          criado_por?: string | null
          filtros_origem?: Json
          id?: string
          mensagem_whatsapp?: string
          modelo_docusign_id?: string | null
          modelo_docusign_nome?: string | null
          nome?: string
          origem?: Database["public"]["Enums"]["wa_campanha_origem"]
          status?: Database["public"]["Enums"]["wa_campanha_status"]
          totais?: Json
          updated_at?: string
        }
        Relationships: []
      }
      wa_integracoes_config: {
        Row: {
          atualizado_por: string | null
          chave: string
          created_at: string
          id: string
          servico: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          atualizado_por?: string | null
          chave: string
          created_at?: string
          id?: string
          servico: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          atualizado_por?: string | null
          chave?: string
          created_at?: string
          id?: string
          servico?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      wa_opt_outs: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          motivo: string | null
          origem: string
          tipo: string
          valor: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          origem?: string
          tipo: string
          valor: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          origem?: string
          tipo?: string
          valor?: string
        }
        Relationships: []
      }
      wa_project_users: {
        Row: {
          adicionado_por: string | null
          ativo: boolean
          trocar_senha: boolean
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adicionado_por?: string | null
          ativo?: boolean
          trocar_senha?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adicionado_por?: string | null
          ativo?: boolean
          trocar_senha?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wa_retencao_config: {
        Row: {
          campanhas_abertas_meses: number
          destinatarios_meses: number
          id: boolean
        }
        Insert: {
          campanhas_abertas_meses?: number
          destinatarios_meses?: number
          id?: boolean
        }
        Update: {
          campanhas_abertas_meses?: number
          destinatarios_meses?: number
          id?: boolean
        }
        Relationships: []
      }
      whatsapp_automacao_config: {
        Row: {
          created_at: string
          debug_mode: boolean | null
          horario_fim: string | null
          horario_inicio: string | null
          ia_max_tokens: number | null
          ia_modelo: string | null
          ia_prompt_base: string | null
          ia_temperatura: number | null
          id: string
          msg_fora_horario: string | null
          notif_docs_recebidos: boolean | null
          notif_email: string | null
          notif_erros: boolean | null
          notif_novas_msgs: boolean | null
          notif_relatorio_diario: boolean | null
          respostas_automaticas: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          debug_mode?: boolean | null
          horario_fim?: string | null
          horario_inicio?: string | null
          ia_max_tokens?: number | null
          ia_modelo?: string | null
          ia_prompt_base?: string | null
          ia_temperatura?: number | null
          id?: string
          msg_fora_horario?: string | null
          notif_docs_recebidos?: boolean | null
          notif_email?: string | null
          notif_erros?: boolean | null
          notif_novas_msgs?: boolean | null
          notif_relatorio_diario?: boolean | null
          respostas_automaticas?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          debug_mode?: boolean | null
          horario_fim?: string | null
          horario_inicio?: string | null
          ia_max_tokens?: number | null
          ia_modelo?: string | null
          ia_prompt_base?: string | null
          ia_temperatura?: number | null
          id?: string
          msg_fora_horario?: string | null
          notif_docs_recebidos?: boolean | null
          notif_email?: string | null
          notif_erros?: boolean | null
          notif_novas_msgs?: boolean | null
          notif_relatorio_diario?: boolean | null
          respostas_automaticas?: Json
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          api_token: string | null
          api_url: string | null
          created_at: string
          id: string
          instance_name: string | null
          is_active: boolean
          provedor: string
          sender_id: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          provedor?: string
          sender_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          provedor?: string
          sender_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          ai_response: string | null
          client_id: string | null
          conversation_thread: string | null
          created_at: string
          file_url: string | null
          id: string
          is_from_client: boolean
          message_text: string | null
          message_type: string
          project_id: string
        }
        Insert: {
          ai_response?: string | null
          client_id?: string | null
          conversation_thread?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_from_client?: boolean
          message_text?: string | null
          message_type?: string
          project_id: string
        }
        Update: {
          ai_response?: string | null
          client_id?: string | null
          conversation_thread?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_from_client?: boolean
          message_text?: string | null
          message_type?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "nina_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "nina_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          created_by: string | null
          direcao: string
          fornecedor_cnpj: string | null
          fornecedor_email: string
          fornecedor_nome: string | null
          fornecedor_whatsapp: string | null
          id: string
          mensagem: string
          status: string | null
          tipo: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          direcao?: string
          fornecedor_cnpj?: string | null
          fornecedor_email: string
          fornecedor_nome?: string | null
          fornecedor_whatsapp?: string | null
          id?: string
          mensagem: string
          status?: string | null
          tipo?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          direcao?: string
          fornecedor_cnpj?: string | null
          fornecedor_email?: string
          fornecedor_nome?: string | null
          fornecedor_whatsapp?: string | null
          id?: string
          mensagem?: string
          status?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      whatsapp_numeros: {
        Row: {
          api_token: string | null
          api_url: string | null
          created_at: string
          enviados_hoje: number
          health_score: number
          id: string
          instance_name: string | null
          janela_fim: string | null
          janela_inicio: string | null
          label: string
          limite_diario: number
          prioridade: number
          provedor: string
          reset_at: string
          sender_id: string | null
          status: string
          ultima_falha_em: string | null
          ultimo_check_em: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          enviados_hoje?: number
          health_score?: number
          id?: string
          instance_name?: string | null
          janela_fim?: string | null
          janela_inicio?: string | null
          label: string
          limite_diario?: number
          prioridade?: number
          provedor?: string
          reset_at?: string
          sender_id?: string | null
          status?: string
          ultima_falha_em?: string | null
          ultimo_check_em?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          enviados_hoje?: number
          health_score?: number
          id?: string
          instance_name?: string | null
          janela_fim?: string | null
          janela_inicio?: string | null
          label?: string
          limite_diario?: number
          prioridade?: number
          provedor?: string
          reset_at?: string
          sender_id?: string | null
          status?: string
          ultima_falha_em?: string | null
          ultimo_check_em?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          funcao_key: string
          funcao_label: string
          id: string
          sender_id: string | null
          sender_phone: string | null
          sender_status: string | null
          template_id: string | null
          updated_at: string
          variaveis: string[]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          funcao_key: string
          funcao_label: string
          id?: string
          sender_id?: string | null
          sender_phone?: string | null
          sender_status?: string | null
          template_id?: string | null
          updated_at?: string
          variaveis?: string[]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          funcao_key?: string
          funcao_label?: string
          id?: string
          sender_id?: string | null
          sender_phone?: string | null
          sender_status?: string | null
          template_id?: string | null
          updated_at?: string
          variaveis?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      admissao_documentos: {
        Row: {
          file_name: string | null
          file_path: string | null
          file_type: string | null
          id: string | null
          solicitacao_id: string | null
          uploaded_at: string | null
        }
        Insert: {
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string | null
          solicitacao_id?: string | null
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string | null
          solicitacao_id?: string | null
          uploaded_at?: string | null
        }
        Relationships: []
      }
      admissao_timeline: {
        Row: {
          created_at: string | null
          id: string | null
          nota: string | null
          solicitacao_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          nota?: string | null
          solicitacao_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          nota?: string | null
          solicitacao_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      solicitacoes_admissao: {
        Row: {
          cpf: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string | null
          motivo_invalidacao: string | null
          nome_candidato: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string | null
          motivo_invalidacao?: string | null
          nome_candidato?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string | null
          motivo_invalidacao?: string | null
          nome_candidato?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vagas: {
        Row: {
          beneficios: string | null
          cargo_codigo: string | null
          created_at: string | null
          data_abertura: string | null
          data_fechamento: string | null
          departamento_codigo: string | null
          descricao: string | null
          id: string | null
          modalidade: string | null
          numero_vagas: number | null
          requisitos: string | null
          responsavel_id: string | null
          salario_ofertado: number | null
          status: string | null
          tipo_contratacao: string | null
          titulo: string | null
        }
        Insert: {
          beneficios?: string | null
          cargo_codigo?: string | null
          created_at?: string | null
          data_abertura?: string | null
          data_fechamento?: string | null
          departamento_codigo?: string | null
          descricao?: string | null
          id?: string | null
          modalidade?: string | null
          numero_vagas?: number | null
          requisitos?: string | null
          responsavel_id?: string | null
          salario_ofertado?: number | null
          status?: string | null
          tipo_contratacao?: string | null
          titulo?: string | null
        }
        Update: {
          beneficios?: string | null
          cargo_codigo?: string | null
          created_at?: string | null
          data_abertura?: string | null
          data_fechamento?: string | null
          departamento_codigo?: string | null
          descricao?: string | null
          id?: string | null
          modalidade?: string | null
          numero_vagas?: number | null
          requisitos?: string | null
          responsavel_id?: string | null
          salario_ofertado?: number | null
          status?: string | null
          tipo_contratacao?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_client_agendamento: {
        Args: { _agendamento_id: string; _motivo: string }
        Returns: {
          bloco: string
          cancelado_em: string
          cliente_nome: string
          cliente_telefone: string
          data_agendamento: string
          empreendimento_nome: string
          hora_inicio: string
          id: string
          motivo_cancelamento: string
          status: Database["public"]["Enums"]["atendimento_status"]
          unidade: string
        }[]
      }
      carregar_parcelas: {
        Args: { p_cod_coligada: number; p_consulta: string; p_dados: Json }
        Returns: {
          inseridas: number
          removidas: number
        }[]
      }
      claim_conversation: {
        Args: { _conversation_id?: string }
        Returns: {
          ai_turns: number
          assigned_to: string | null
          channel_id: string | null
          claimed_at: string | null
          cliente_id: string | null
          contact_name: string | null
          contact_phone: string
          cpf_identificado: string | null
          created_at: string
          handoff_reason: string | null
          handoff_tag: string | null
          id: string
          last_message_at: string
          metadata: Json
          preset_id: string | null
          priority: number
          queued_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_client_agendamento:
        | {
            Args: {
              _bloco: string
              _data_agendamento: string
              _empreendimento_id: string
              _hora_inicio: string
              _observacoes: string
              _tipo_atendimento_id: string
              _unidade: string
            }
            Returns: string
          }
        | {
            Args: {
              _bloco: string
              _data_agendamento: string
              _empreendimento_codigo_totvs?: string
              _empreendimento_id: string
              _empreendimento_nome?: string
              _hora_inicio: string
              _observacoes: string
              _tipo_atendimento_id: string
              _unidade: string
            }
            Returns: string
          }
      eh_admin_organizacao: { Args: never; Returns: boolean }
      garantir_perfil_usuario: {
        Args: never
        Returns: {
          ativo: boolean
          criado_em: string
          email: string | null
          id: string
          nome: string
          organizacao_id: string
          perfil: string
          postos_permitidos: string[]
          ultimo_acesso: string | null
        }
        SetofOptions: {
          from: "*"
          to: "usuarios_perfil"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_bloqueio_de: {
        Args: { p_email: string; p_user_id: string }
        Returns: string | null
      }
      auth_desbloquear: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      auth_pre_login: {
        Args: { p_email: string; p_ip: string }
        Returns: Json
      }
      auth_registrar_resultado: {
        Args: {
          p_email: string
          p_ip: string
          p_ok: boolean
          p_user_id?: string | null
          p_ua?: string | null
          p_origem?: string
          p_resultado?: string | null
        }
        Returns: Json
      }
      wa_anonimizar_campanha: {
        Args: { p_campanha_id: string }
        Returns: number
      }
      wa_anonimizar_titular: {
        Args: { p_cpf?: string | null; p_email?: string | null; p_telefone?: string | null }
        Returns: number
      }
      wa_segredo_existe: {
        Args: { p_nome: string }
        Returns: boolean
      }
      wa_segredo_gravar: {
        Args: { p_descricao?: string | null; p_nome: string; p_valor: string }
        Returns: string
      }
      wa_segredo_ler: {
        Args: { p_nome: string }
        Returns: string | null
      }
      wa_titular_ocorrencias: {
        Args: { p_cpf?: string | null; p_email?: string | null; p_telefone?: string | null }
        Returns: {
          destinatario_id: string
          campanha_id: string
          campanha_nome: string
          campanha_criada_em: string
          status: string
          empreendimento: string | null
          enviado_em: string | null
          papel: string
          anonimizado_em: string | null
        }[]
      }
      auth_revogar_sessoes: {
        Args: { p_user_id: string; p_manter_sessao?: string | null }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      rm_consulta_registrar: {
        Args: { p_recurso?: string }
        Returns: undefined
      }
      rm_credenciais: {
        Args: { p_recurso?: string }
        Returns: {
          endpoint: string
          senha: string
          usuario: string
        }[]
      }
      rm_credenciais_salvar: {
        Args: {
          p_autor: string
          p_endpoint: string
          p_recurso?: string
          p_senha: string
          p_usuario: string
        }
        Returns: undefined
      }
      rm_status: {
        Args: never
        Returns: {
          atualizado_em: string
          atualizado_por: string
          configurado: boolean
          endpoint: string
          recurso: string
          ultima_consulta: string | null
          usuario: string
        }[]
      }
      organizacao_do_usuario: { Args: never; Returns: string }
      registrar_resposta_kit_porcelanato: {
        Args: {
          _bloco: string
          _contratacao: boolean
          _nome: string
          _tipo?: string
          _unidade: string
        }
        Returns: {
          bloco: string
          contratacao_kit: boolean
          created_at: string
          data_resposta: string
          id: string
          justificativa_manual: string | null
          nome_comprador: string
          origem: string
          pdf_gerado: boolean
          registrado_por: string | null
          tipo_porcelanato: string | null
          unidade: string
        }
        SetofOptions: {
          from: "*"
          to: "kit_porcelanato_respostas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_tipo_evento_horarios: {
        Args: { _horarios: Json; _tipo_id: string }
        Returns: undefined
      }
      request_handoff: {
        Args: {
          _conversation_id: string
          _priority?: number
          _reason?: string
          _tag?: string
        }
        Returns: {
          ai_turns: number
          assigned_to: string | null
          channel_id: string | null
          claimed_at: string | null
          cliente_id: string | null
          contact_name: string | null
          contact_phone: string
          cpf_identificado: string | null
          created_at: string
          handoff_reason: string | null
          handoff_tag: string | null
          id: string
          last_message_at: string
          metadata: Json
          preset_id: string | null
          priority: number
          queued_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_horario_ativo: {
        Args: { _ativo: boolean; _id: string; _table: string }
        Returns: undefined
      }
      set_tipo_atendimento_ativo: {
        Args: { _ativo: boolean; _tipo_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "operadora" | "cliente"
      assistente_kb_tipo:
        | "system_prompt"
        | "regra_negocio"
        | "tool_description"
        | "fluxo"
        | "faq"
      atendimento_status:
        | "agendado"
        | "em_andamento"
        | "finalizado"
        | "cancelado"
        | "pendente_aprovacao"
      wa_campanha_origem: "totvs" | "excel"
      wa_campanha_status:
        | "rascunho"
        | "rascunho_confirmado"
        | "em_execucao"
        | "concluida"
        | "erro"
        | "cancelada"
      wa_destinatario_status:
        | "pendente"
        | "enviado"
        | "entregue"
        | "assinado"
        | "erro"
        | "opt_out"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "operadora", "cliente"],
      assistente_kb_tipo: [
        "system_prompt",
        "regra_negocio",
        "tool_description",
        "fluxo",
        "faq",
      ],
      atendimento_status: [
        "agendado",
        "em_andamento",
        "finalizado",
        "cancelado",
        "pendente_aprovacao",
      ],
      wa_campanha_origem: ["totvs", "excel"],
      wa_campanha_status: [
        "rascunho",
        "rascunho_confirmado",
        "em_execucao",
        "concluida",
        "erro",
        "cancelada",
      ],
      wa_destinatario_status: [
        "pendente",
        "enviado",
        "entregue",
        "assinado",
        "erro",
        "opt_out",
      ],
    },
  },
} as const
