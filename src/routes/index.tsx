import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});

// crie um menu Página Inicial, com icone de uma casinha, sendo posicionado no primeiro, com uma mensagem de boas vindas ao usuário logado, o nome do usuário deverá ter a primeira letra maiuscula e no lugar do ponto um espaço, essa Página Inicial deverá ter cards interativos com os seguintes menus do projeto : Dashboard, Novo Disparo, Histórico e Relatórios, obdecendo o perfil do usuário logado, ao clicar nos card ele leva examente para o menu , que sempre após o login sera aberto a Página Inicial, todos esses card deverão ter os icones ja utilizados no menu, crie com icones coloridos e amigaveis, utilizando as cores desse projeto, utilize o estilo ui/ex e que seja responsivo a tela do operador, monte um plano de implementação para minha aprovação
