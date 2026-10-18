// Gerado por scripts/gerar-tipos-banco.mjs (npm run tipos) a partir de supabase/imobsystem/migrations. Não edite à mão.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  imobenviomassa: {
    Tables: {
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
          imobiliaria_id: string
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
          imobiliaria_id: string
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
          imobiliaria_id?: string
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
        Relationships: [
          {
            foreignKeyName: "api_registry_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_bloqueio_config: {
        Row: {
          bloqueio_ip_minutos: number
          bloqueio_max_horas: number
          bloqueio_minutos: number
          id: boolean
          janela_minutos: number
          max_falhas: number
          max_falhas_ip: number
        }
        Insert: {
          bloqueio_ip_minutos?: number
          bloqueio_max_horas?: number
          bloqueio_minutos?: number
          id?: boolean
          janela_minutos?: number
          max_falhas?: number
          max_falhas_ip?: number
        }
        Update: {
          bloqueio_ip_minutos?: number
          bloqueio_max_horas?: number
          bloqueio_minutos?: number
          id?: boolean
          janela_minutos?: number
          max_falhas?: number
          max_falhas_ip?: number
        }
        Relationships: [
        ]
      }
      auth_falhas_por_usuario: {
        Row: {
          bloqueado_ate: string | null
          bloqueios: number
          falhas: number
          primeira_falha_em: string | null
          ultima_falha_em: string | null
          user_id: string
        }
        Insert: {
          bloqueado_ate?: string | null
          bloqueios?: number
          falhas?: number
          primeira_falha_em?: string | null
          ultima_falha_em?: string | null
          user_id: string
        }
        Update: {
          bloqueado_ate?: string | null
          bloqueios?: number
          falhas?: number
          primeira_falha_em?: string | null
          ultima_falha_em?: string | null
          user_id?: string
        }
        Relationships: [
        ]
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
        Relationships: [
        ]
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
        Relationships: [
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
          imobiliaria_id: string
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
          imobiliaria_id: string
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
          imobiliaria_id?: string
          impersonated_user_id?: string | null
          integration_key?: string | null
          rsa_private_key?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "docusign_config_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: true
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
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
          imobiliaria_id: string
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
          imobiliaria_id: string
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
          imobiliaria_id?: string
          last_event_at?: string | null
          raw?: Json | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "docusign_envelopes_campanha_id_imobiliaria_id_fkey"
            columns: ["campanha_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "wa_campanhas"
            referencedColumns: ["id", "imobiliaria_id"]
          },
          {
            foreignKeyName: "docusign_envelopes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "wa_campanha_destinatarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "docusign_envelopes_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      email_provedor: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          credencial_testada_em: string | null
          dominio: string | null
          dominio_id_provedor: string | null
          dominio_verificado_em: string | null
          imobiliaria_id: string
          registros_dns: Json
          remetente_email: string | null
          remetente_nome: string | null
          reply_to: string | null
          smtp_host: string | null
          smtp_porta: number | null
          smtp_seguro: boolean
          smtp_usuario: string | null
          status_dominio: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          credencial_testada_em?: string | null
          dominio?: string | null
          dominio_id_provedor?: string | null
          dominio_verificado_em?: string | null
          imobiliaria_id: string
          registros_dns?: Json
          remetente_email?: string | null
          remetente_nome?: string | null
          reply_to?: string | null
          smtp_host?: string | null
          smtp_porta?: number | null
          smtp_seguro?: boolean
          smtp_usuario?: string | null
          status_dominio?: string | null
          tipo?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          credencial_testada_em?: string | null
          dominio?: string | null
          dominio_id_provedor?: string | null
          dominio_verificado_em?: string | null
          imobiliaria_id?: string
          registros_dns?: Json
          remetente_email?: string | null
          remetente_nome?: string | null
          reply_to?: string | null
          smtp_host?: string | null
          smtp_porta?: number | null
          smtp_seguro?: boolean
          smtp_usuario?: string | null
          status_dominio?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_provedor_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: true
            referencedRelation: "imobiliarias"
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
          imobiliaria_id: string | null
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
          imobiliaria_id?: string | null
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
          imobiliaria_id?: string | null
          kind?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_call_log_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      imobiliarias: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cnpj: string | null
          criado_em: string
          id: string
          nome: string
          tenant_externo_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          id?: string
          nome: string
          tenant_externo_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          id?: string
          nome?: string
          tenant_externo_id?: string | null
        }
        Relationships: [
        ]
      }
      integracao_rm: {
        Row: {
          atualizado_em: string
          atualizado_por: string
          imobiliaria_id: string
          senha: string
          usuario: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string
          imobiliaria_id: string
          senha?: string
          usuario?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string
          imobiliaria_id?: string
          senha?: string
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracao_rm_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: true
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_rm_recurso: {
        Row: {
          atualizado_em: string
          atualizado_por: string
          endpoint: string
          imobiliaria_id: string
          recurso: string
          ultima_consulta: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string
          endpoint?: string
          imobiliaria_id: string
          recurso: string
          ultima_consulta?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string
          endpoint?: string
          imobiliaria_id?: string
          recurso?: string
          ultima_consulta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracao_rm_recurso_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_zenvia: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          imobiliaria_id: string
          status_conexao: string
          testado_em: string | null
          teste_resumo: Json
          webhook_ids: Json
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          imobiliaria_id: string
          status_conexao?: string
          testado_em?: string | null
          teste_resumo?: Json
          webhook_ids?: Json
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          imobiliaria_id?: string
          status_conexao?: string
          testado_em?: string | null
          teste_resumo?: Json
          webhook_ids?: Json
        }
        Relationships: [
          {
            foreignKeyName: "integracao_zenvia_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: true
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_permissoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          enabled: boolean
          imobiliaria_id: string
          perfil: string
          permission_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          enabled: boolean
          imobiliaria_id: string
          perfil: string
          permission_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          enabled?: boolean
          imobiliaria_id?: string
          perfil?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_permissoes_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_permissoes_perfil_fkey"
            columns: ["perfil"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["chave"]
          },
        ]
      }
      perfis: {
        Row: {
          atualizado_em: string
          chave: string
          criado_em: string
          descricao: string | null
          imobiliaria_id: string | null
          nome: string
          ordem: number
          sistema: boolean
        }
        Insert: {
          atualizado_em?: string
          chave: string
          criado_em?: string
          descricao?: string | null
          imobiliaria_id?: string | null
          nome: string
          ordem?: number
          sistema?: boolean
        }
        Update: {
          atualizado_em?: string
          chave?: string
          criado_em?: string
          descricao?: string | null
          imobiliaria_id?: string | null
          nome?: string
          ordem?: number
          sistema?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "perfis_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      regua_boleto: {
        Row: {
          anonimizado_em: string | null
          atualizado_em: string
          cliente_codigo: string | null
          cliente_nome: string
          cpf_cnpj: string | null
          criado_em: string
          dados: Json
          dias_atraso: number | null
          empreendimento: string | null
          id: string
          imobiliaria_id: string
          incluido: boolean
          linha_digitavel: string | null
          lote_id: string
          numero: string
          status_geral: string
          status_registro_banco: string
          unidade: string | null
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          anonimizado_em?: string | null
          atualizado_em?: string
          cliente_codigo?: string | null
          cliente_nome: string
          cpf_cnpj?: string | null
          criado_em?: string
          dados?: Json
          dias_atraso?: number | null
          empreendimento?: string | null
          id?: string
          imobiliaria_id: string
          incluido?: boolean
          linha_digitavel?: string | null
          lote_id: string
          numero: string
          status_geral?: string
          status_registro_banco?: string
          unidade?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          anonimizado_em?: string | null
          atualizado_em?: string
          cliente_codigo?: string | null
          cliente_nome?: string
          cpf_cnpj?: string | null
          criado_em?: string
          dados?: Json
          dias_atraso?: number | null
          empreendimento?: string | null
          id?: string
          imobiliaria_id?: string
          incluido?: boolean
          linha_digitavel?: string | null
          lote_id?: string
          numero?: string
          status_geral?: string
          status_registro_banco?: string
          unidade?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_boleto_lote_id_imobiliaria_id_fkey"
            columns: ["lote_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "regua_lote"
            referencedColumns: ["id", "imobiliaria_id"]
          },
        ]
      }
      regua_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          imobiliaria_id: string
          intervalo_whatsapp_seg: number
          regra_senha: string
          texto_dica: string
          validade_link_horas: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          imobiliaria_id: string
          intervalo_whatsapp_seg?: number
          regra_senha?: string
          texto_dica?: string
          validade_link_horas?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          imobiliaria_id?: string
          intervalo_whatsapp_seg?: number
          regra_senha?: string
          texto_dica?: string
          validade_link_horas?: number
        }
        Relationships: [
          {
            foreignKeyName: "regua_config_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: true
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      regua_contato: {
        Row: {
          boleto_id: string
          canal: string
          id: string
          imobiliaria_id: string
          status_validacao: string
          validado_em: string
          valor: string | null
        }
        Insert: {
          boleto_id: string
          canal: string
          id?: string
          imobiliaria_id: string
          status_validacao: string
          validado_em?: string
          valor?: string | null
        }
        Update: {
          boleto_id?: string
          canal?: string
          id?: string
          imobiliaria_id?: string
          status_validacao?: string
          validado_em?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_contato_boleto_id_imobiliaria_id_fkey"
            columns: ["boleto_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "regua_boleto"
            referencedColumns: ["id", "imobiliaria_id"]
          },
        ]
      }
      regua_documento: {
        Row: {
          boleto_id: string
          criado_em: string
          expira_em: string
          id: string
          imobiliaria_id: string
          protegido: boolean
          removido_em: string | null
          storage_path: string
          tamanho_bytes: number | null
        }
        Insert: {
          boleto_id: string
          criado_em?: string
          expira_em: string
          id?: string
          imobiliaria_id: string
          protegido?: boolean
          removido_em?: string | null
          storage_path: string
          tamanho_bytes?: number | null
        }
        Update: {
          boleto_id?: string
          criado_em?: string
          expira_em?: string
          id?: string
          imobiliaria_id?: string
          protegido?: boolean
          removido_em?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_documento_boleto_id_imobiliaria_id_fkey"
            columns: ["boleto_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "regua_boleto"
            referencedColumns: ["id", "imobiliaria_id"]
          },
        ]
      }
      regua_lote: {
        Row: {
          atualizado_em: string
          canais: string[]
          cancelado_em: string | null
          contadores: Json
          criado_em: string
          faixa_atraso: string | null
          filtros: Json
          finalizado_em: string | null
          id: string
          imobiliaria_id: string
          iniciado_em: string | null
          justificativa: string | null
          numero: number
          observacao: string | null
          origem: string
          periodo_vencimento: unknown | null
          status: string
          template_email_id: string | null
          template_whatsapp_id: string | null
          tipo: string
          tipo_regua: string
          titulo: string
          usuario_id: string
          usuario_nome: string | null
        }
        Insert: {
          atualizado_em?: string
          canais: string[]
          cancelado_em?: string | null
          contadores?: Json
          criado_em?: string
          faixa_atraso?: string | null
          filtros?: Json
          finalizado_em?: string | null
          id?: string
          imobiliaria_id: string
          iniciado_em?: string | null
          justificativa?: string | null
          numero?: number
          observacao?: string | null
          origem: string
          periodo_vencimento?: unknown | null
          status?: string
          template_email_id?: string | null
          template_whatsapp_id?: string | null
          tipo?: string
          tipo_regua: string
          titulo: string
          usuario_id: string
          usuario_nome?: string | null
        }
        Update: {
          atualizado_em?: string
          canais?: string[]
          cancelado_em?: string | null
          contadores?: Json
          criado_em?: string
          faixa_atraso?: string | null
          filtros?: Json
          finalizado_em?: string | null
          id?: string
          imobiliaria_id?: string
          iniciado_em?: string | null
          justificativa?: string | null
          numero?: number
          observacao?: string | null
          origem?: string
          periodo_vencimento?: unknown | null
          status?: string
          template_email_id?: string | null
          template_whatsapp_id?: string | null
          tipo?: string
          tipo_regua?: string
          titulo?: string
          usuario_id?: string
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_lote_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regua_lote_template_email_id_imobiliaria_id_fkey"
            columns: ["template_email_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "regua_template"
            referencedColumns: ["id", "imobiliaria_id"]
          },
          {
            foreignKeyName: "regua_lote_template_whatsapp_id_imobiliaria_id_fkey"
            columns: ["template_whatsapp_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "regua_template"
            referencedColumns: ["id", "imobiliaria_id"]
          },
        ]
      }
      regua_template: {
        Row: {
          anexo_tipo: string
          assunto: string | null
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          canal: string
          corpo: string | null
          criado_em: string
          id: string
          imobiliaria_id: string
          mapa_variaveis: Json
          nome: string
          regua_sugerida: string | null
          remetente_id: string | null
          usa_documento: boolean
          whatsapp_template_id: string | null
        }
        Insert: {
          anexo_tipo?: string
          assunto?: string | null
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          canal: string
          corpo?: string | null
          criado_em?: string
          id?: string
          imobiliaria_id: string
          mapa_variaveis?: Json
          nome: string
          regua_sugerida?: string | null
          remetente_id?: string | null
          usa_documento?: boolean
          whatsapp_template_id?: string | null
        }
        Update: {
          anexo_tipo?: string
          assunto?: string | null
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          canal?: string
          corpo?: string | null
          criado_em?: string
          id?: string
          imobiliaria_id?: string
          mapa_variaveis?: Json
          nome?: string
          regua_sugerida?: string | null
          remetente_id?: string | null
          usa_documento?: boolean
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_template_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regua_template_remetente_id_imobiliaria_id_fkey"
            columns: ["remetente_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_remetente"
            referencedColumns: ["id", "imobiliaria_id"]
          },
          {
            foreignKeyName: "regua_template_whatsapp_template_id_imobiliaria_id_fkey"
            columns: ["whatsapp_template_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_template"
            referencedColumns: ["id", "imobiliaria_id"]
          },
        ]
      }
      regua_tentativa: {
        Row: {
          atualizado_em: string
          boleto_id: string
          canal: string
          criado_em: string
          entregue_em: string | null
          erro: string | null
          id: string
          id_provedor: string | null
          imobiliaria_id: string
          lote_id: string
          mensagem_renderizada: string | null
          payload: Json | null
          provedor: string | null
          resposta: Json | null
          status: string
          tentado_em: string | null
        }
        Insert: {
          atualizado_em?: string
          boleto_id: string
          canal: string
          criado_em?: string
          entregue_em?: string | null
          erro?: string | null
          id?: string
          id_provedor?: string | null
          imobiliaria_id: string
          lote_id: string
          mensagem_renderizada?: string | null
          payload?: Json | null
          provedor?: string | null
          resposta?: Json | null
          status?: string
          tentado_em?: string | null
        }
        Update: {
          atualizado_em?: string
          boleto_id?: string
          canal?: string
          criado_em?: string
          entregue_em?: string | null
          erro?: string | null
          id?: string
          id_provedor?: string | null
          imobiliaria_id?: string
          lote_id?: string
          mensagem_renderizada?: string | null
          payload?: Json | null
          provedor?: string | null
          resposta?: Json | null
          status?: string
          tentado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_tentativa_boleto_id_imobiliaria_id_fkey"
            columns: ["boleto_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "regua_boleto"
            referencedColumns: ["id", "imobiliaria_id"]
          },
          {
            foreignKeyName: "regua_tentativa_lote_id_imobiliaria_id_fkey"
            columns: ["lote_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "regua_lote"
            referencedColumns: ["id", "imobiliaria_id"]
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
        Relationships: [
        ]
      }
      usuarios: {
        Row: {
          adicionado_por: string | null
          ativo: boolean
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          imobiliaria_id: string
          nome: string | null
          perfil: string
          trocar_senha: boolean
          ultimo_acesso: string | null
        }
        Insert: {
          adicionado_por?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email: string
          id: string
          imobiliaria_id: string
          nome?: string | null
          perfil?: string
          trocar_senha?: boolean
          ultimo_acesso?: string | null
        }
        Update: {
          adicionado_por?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          imobiliaria_id?: string
          nome?: string | null
          perfil?: string
          trocar_senha?: boolean
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_perfil_fkey"
            columns: ["perfil"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["chave"]
          },
        ]
      }
      wa_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          entidade: string | null
          entidade_id: string | null
          id: string
          imobiliaria_id: string | null
          ip: string | null
          user_agent: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          imobiliaria_id?: string | null
          ip?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          imobiliaria_id?: string | null
          ip?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_auditoria_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
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
          imobiliaria_id: string
          nome: string
          status: Database["imobenviomassa"]["Enums"]["wa_destinatario_status"]
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
          imobiliaria_id: string
          nome: string
          status?: Database["imobenviomassa"]["Enums"]["wa_destinatario_status"]
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
          imobiliaria_id?: string
          nome?: string
          status?: Database["imobenviomassa"]["Enums"]["wa_destinatario_status"]
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_campanha_destinatarios_campanha_id_imobiliaria_id_fkey"
            columns: ["campanha_id", "imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "wa_campanhas"
            referencedColumns: ["id", "imobiliaria_id"]
          },
        ]
      }
      wa_campanhas: {
        Row: {
          config_assinatura: Json
          created_at: string
          criado_por: string
          filtros_origem: Json
          id: string
          imobiliaria_id: string
          mensagem_whatsapp: string
          modelo_docusign_id: string | null
          modelo_docusign_nome: string | null
          nome: string
          origem: Database["imobenviomassa"]["Enums"]["wa_campanha_origem"]
          status: Database["imobenviomassa"]["Enums"]["wa_campanha_status"]
          totais: Json
          updated_at: string
        }
        Insert: {
          config_assinatura?: Json
          created_at?: string
          criado_por: string
          filtros_origem?: Json
          id?: string
          imobiliaria_id: string
          mensagem_whatsapp?: string
          modelo_docusign_id?: string | null
          modelo_docusign_nome?: string | null
          nome: string
          origem: Database["imobenviomassa"]["Enums"]["wa_campanha_origem"]
          status?: Database["imobenviomassa"]["Enums"]["wa_campanha_status"]
          totais?: Json
          updated_at?: string
        }
        Update: {
          config_assinatura?: Json
          created_at?: string
          criado_por?: string
          filtros_origem?: Json
          id?: string
          imobiliaria_id?: string
          mensagem_whatsapp?: string
          modelo_docusign_id?: string | null
          modelo_docusign_nome?: string | null
          nome?: string
          origem?: Database["imobenviomassa"]["Enums"]["wa_campanha_origem"]
          status?: Database["imobenviomassa"]["Enums"]["wa_campanha_status"]
          totais?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_campanhas_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_opt_outs: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          imobiliaria_id: string
          motivo: string | null
          origem: string
          tipo: string
          valor: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          imobiliaria_id: string
          motivo?: string | null
          origem?: string
          tipo: string
          valor: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          imobiliaria_id?: string
          motivo?: string | null
          origem?: string
          tipo?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_opt_outs_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_retencao_config: {
        Row: {
          campanhas_abertas_meses: number
          destinatarios_meses: number
          imobiliaria_id: string
        }
        Insert: {
          campanhas_abertas_meses?: number
          destinatarios_meses?: number
          imobiliaria_id: string
        }
        Update: {
          campanhas_abertas_meses?: number
          destinatarios_meses?: number
          imobiliaria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_retencao_config_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: true
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_remetente: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          imobiliaria_id: string
          na_conta: boolean
          nome: string | null
          numero: string
          padrao_regua: boolean
          setor: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          imobiliaria_id: string
          na_conta?: boolean
          nome?: string | null
          numero: string
          padrao_regua?: boolean
          setor?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          imobiliaria_id?: string
          na_conta?: boolean
          nome?: string | null
          numero?: string
          padrao_regua?: boolean
          setor?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_remetente_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_template: {
        Row: {
          categoria: string | null
          corpo: string | null
          header_tipo: string | null
          id: string
          idioma: string | null
          imobiliaria_id: string
          nome: string
          sender_id: string | null
          sincronizado_em: string
          status: string
          variaveis: Json
          zenvia_id: string
        }
        Insert: {
          categoria?: string | null
          corpo?: string | null
          header_tipo?: string | null
          id?: string
          idioma?: string | null
          imobiliaria_id: string
          nome: string
          sender_id?: string | null
          sincronizado_em?: string
          status: string
          variaveis?: Json
          zenvia_id: string
        }
        Update: {
          categoria?: string | null
          corpo?: string | null
          header_tipo?: string | null
          id?: string
          idioma?: string | null
          imobiliaria_id?: string
          nome?: string
          sender_id?: string | null
          sincronizado_em?: string
          status?: string
          variaveis?: Json
          zenvia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_template_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      zenvia_eventos: {
        Row: {
          id: string
          imobiliaria_id: string
          payload: Json
          recebido_em: string
          status: string | null
          tipo: string
          zenvia_id: string | null
        }
        Insert: {
          id?: string
          imobiliaria_id: string
          payload: Json
          recebido_em?: string
          status?: string | null
          tipo: string
          zenvia_id?: string | null
        }
        Update: {
          id?: string
          imobiliaria_id?: string
          payload?: Json
          recebido_em?: string
          status?: string | null
          tipo?: string
          zenvia_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zenvia_eventos_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_bloqueio_de: {
        Args: {
          p_email: string
          p_user_id: string
        }
        Returns: string
      }
      auth_bloqueio_parametros: {
        Args: never
        Returns: {
          max_falhas: number
          janela_minutos: number
          bloqueio_minutos: number
          bloqueio_max_horas: number
          max_falhas_ip: number
          bloqueio_ip_minutos: number
        }[]
      }
      auth_desbloquear: {
        Args: {
          p_email: string
          p_user_id: string
        }
        Returns: undefined
      }
      auth_id_por_email: {
        Args: {
          p_email: string
        }
        Returns: string
      }
      auth_pre_login: {
        Args: {
          p_email: string
          p_ip: string
        }
        Returns: Json
      }
      auth_registrar_resultado: {
        Args: {
          p_email: string
          p_ip: string
          p_ok: boolean
          p_user_id?: string | null
          p_ua?: string | null
          p_origem?: string | null
          p_resultado?: string | null
        }
        Returns: Json
      }
      auth_revogar_sessoes: {
        Args: {
          p_user_id: string
          p_manter_sessao?: string | null
        }
        Returns: number
      }
      concluir_troca_senha: {
        Args: never
        Returns: undefined
      }
      conta_liberada: {
        Args: never
        Returns: boolean
      }
      criar_perfil: {
        Args: {
          p_nome: string
          p_descricao?: string | null
        }
        Returns: string
      }
      editar_perfil: {
        Args: {
          p_chave: string
          p_nome: string
          p_descricao?: string | null
        }
        Returns: undefined
      }
      eh_gestor_perfis: {
        Args: never
        Returns: boolean
      }
      erro: {
        Args: {
          p_codigo: string
          p_mensagem: string
        }
        Returns: undefined
      }
      excluir_perfil: {
        Args: {
          p_chave: string
        }
        Returns: undefined
      }
      listar_perfis: {
        Args: never
        Returns: {
          chave: string
          nome: string
          descricao: string
          ordem: number
          sistema: boolean
          travado: boolean
          total_usuarios: number
          editavel: boolean
        }[]
      }
      meu_acesso: {
        Args: never
        Returns: {
          imobiliaria_id: string
          imobiliaria_nome: string
          perfil: string
          perfil_nome: string
          ativo: boolean
          trocar_senha: boolean
          regras: Json
        }[]
      }
      meu_perfil: {
        Args: never
        Returns: string
      }
      provisionar_imobiliaria: {
        Args: {
          p_imobiliaria: string
        }
        Returns: undefined
      }
      registrar_acesso: {
        Args: never
        Returns: undefined
      }
      registrar_auditoria: {
        Args: {
          p_acao: string
          p_entidade: string
          p_entidade_id: string
          p_detalhes: Json
        }
        Returns: undefined
      }
      regras_do_perfil: {
        Args: {
          p_perfil: string
        }
        Returns: {
          permission_id: string
          enabled: boolean
        }[]
      }
      regua_contadores: {
        Args: {
          p_lote: string
        }
        Returns: Json
      }
      regua_enviado_24h: {
        Args: {
          p_imobiliaria: string
          p_numero: string
          p_canal: string
          p_ignorar_lote?: string | null
        }
        Returns: boolean
      }
      regua_liberar_presas: {
        Args: {
          p_imobiliaria: string
          p_lote: string
        }
        Returns: number
      }
      regua_numeros_enviados_24h: {
        Args: {
          p_imobiliaria: string
          p_numeros: string[]
          p_canal: string
        }
        Returns: string[]
      }
      regua_painel: {
        Args: {
          p_imobiliaria: string
          p_de: string
          p_ate: string
          p_empreendimento?: string | null
          p_canal?: string | null
          p_regua?: string | null
          p_lote?: string | null
          p_status?: string | null
        }
        Returns: Json
      }
      regua_recalcular_boleto: {
        Args: {
          p_boleto: string
        }
        Returns: string
      }
      regua_recalcular_lote: {
        Args: {
          p_lote: string
        }
        Returns: number
      }
      regua_reservar_tentativas: {
        Args: {
          p_imobiliaria: string
          p_lote: string
          p_limite: number
        }
        Returns: unknown[]
      }
      rm_consulta_registrar: {
        Args: {
          p_imobiliaria: string
          p_recurso: string
        }
        Returns: undefined
      }
      rm_credenciais: {
        Args: {
          p_imobiliaria: string
          p_recurso?: string | null
        }
        Returns: {
          endpoint: string
          usuario: string
          senha: string
        }[]
      }
      rm_credenciais_salvar: {
        Args: {
          p_imobiliaria: string
          p_endpoint: string
          p_usuario: string
          p_senha: string
          p_autor: string
          p_recurso?: string | null
        }
        Returns: undefined
      }
      rm_status: {
        Args: {
          p_imobiliaria: string
        }
        Returns: {
          recurso: string
          configurado: boolean
          endpoint: string
          usuario: string
          atualizado_em: string
          atualizado_por: string
          ultima_consulta: string
        }[]
      }
      salvar_permissoes_perfil: {
        Args: {
          p_perfil: string
          p_alteracoes: Json
        }
        Returns: number
      }
      segredo_nome_valido: {
        Args: {
          p_nome: string
        }
        Returns: boolean
      }
      sou_admin: {
        Args: never
        Returns: boolean
      }
      sufixo_imob: {
        Args: {
          p_imobiliaria: string
        }
        Returns: string
      }
      tem_permissao: {
        Args: {
          p_permissao: string
        }
        Returns: boolean
      }
      tem_permissao_de: {
        Args: {
          p_usuario: string
          p_permissao: string
        }
        Returns: boolean
      }
      tenant_atual: {
        Args: never
        Returns: string
      }
      wa_anonimizar_campanha: {
        Args: {
          p_imobiliaria: string
          p_campanha_id: string
        }
        Returns: number
      }
      wa_anonimizar_linhas: {
        Args: {
          p_ids: string[]
        }
        Returns: number
      }
      wa_anonimizar_titular: {
        Args: {
          p_imobiliaria: string
          p_cpf?: string | null
          p_email?: string | null
          p_telefone?: string | null
        }
        Returns: number
      }
      wa_norm_tel: {
        Args: {
          p: string
        }
        Returns: string
      }
      wa_retencao_executar: {
        Args: never
        Returns: {
          tabela: string
          apagados: number
        }[]
      }
      wa_segredo_existe: {
        Args: {
          p_nome: string
        }
        Returns: boolean
      }
      wa_segredo_gravar: {
        Args: {
          p_nome: string
          p_valor: string
          p_descricao?: string | null
        }
        Returns: string
      }
      wa_segredo_ler: {
        Args: {
          p_nome: string
        }
        Returns: string
      }
      wa_titular_ocorrencias: {
        Args: {
          p_imobiliaria: string
          p_cpf?: string | null
          p_email?: string | null
          p_telefone?: string | null
        }
        Returns: {
          destinatario_id: string
          campanha_id: string
          campanha_nome: string
          campanha_criada_em: string
          status: string
          empreendimento: string
          enviado_em: string
          papel: string
          anonimizado_em: string
        }[]
      }
    }
    Enums: {
      wa_campanha_origem: "totvs" | "excel"
      wa_campanha_status: "rascunho" | "rascunho_confirmado" | "em_execucao" | "concluida" | "erro" | "cancelada"
      wa_destinatario_status: "pendente" | "enviado" | "entregue" | "assinado" | "erro" | "opt_out"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pode_acessar_app: { Args: { p_app: string }; Returns: boolean }
      pa_sou_super_admin: { Args: never; Returns: boolean }
      pa_listar_aplicativos: {
        Args: never
        Returns: {
          schema_name: string
          nome: string
          url: string | null
          controle_ativo: boolean
          padrao_novos: string
          schema_dados: string
          ultima_verificacao_em: string | null
          controle_ativado_em: string | null
          liberados: number
          bloqueados: number
        }[]
      }
      pa_listar_usuarios: {
        Args: { p_app: string; p_busca?: string }
        Returns: {
          user_id: string
          email: string
          criado_em: string
          ultimo_login: string | null
          proprietario: boolean
          tem_cadastro: boolean
          decisao: boolean | null
          efetivo: boolean
        }[]
      }
      pa_definir_controle: { Args: { p_app: string; p_ativo: boolean }; Returns: undefined }
      pa_definir_permissao: { Args: { p_app: string; p_usuario: string; p_pode: boolean | null }; Returns: boolean }
      pa_salvar_aplicativo: {
        Args: { p_app: string; p_nome: string; p_url: string; p_padrao_novos: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals["imobenviomassa"]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]

export const Constants = {
  imobenviomassa: {
    Enums: {
      wa_campanha_origem: ["totvs", "excel"],
      wa_campanha_status: ["rascunho", "rascunho_confirmado", "em_execucao", "concluida", "erro", "cancelada"],
      wa_destinatario_status: ["pendente", "enviado", "entregue", "assinado", "erro", "opt_out"],
    },
  },
} as const
