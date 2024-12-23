$(document).ready(async function() {
    await boot()

    let startColumn=null;

    // Function to save current board state to local storage
    function saveState() {
      localStorage.setItem('pf-kanban-board', JSON.stringify({accountPosition:accountPosition, columns:columns}));
    }

    function initializeBoard() {
        for (const [id, account] of Object.entries(appState.accounts)) {
            if (['liq', 'deps', 'depl'].includes(account.asset_type) && !(id in accountPosition)) {
                const accountCard = $(
                `<div data-id=${id} class="kanban-card card mb-2" style="cursor: grab;">
                    <div class="card-body p-2">
                        <h6 class="card-title m-0">${account.name}</h6>
                        <p class="card-text m-0">${Utils.formatCurrency(account.total)}</p>
                    </div>
                </div>`
                );
                accountPosition[id] = {title: "Accounts", id: "accounts"};
                $('#accounts').append(accountCard);
            }
            updateColumnBudget($('#accounts'));
        }
    }

    function restoreState() {
        const savedState = localStorage.getItem('pf-kanban-board');
        if (savedState) {
            let state = JSON.parse(savedState);
            accountPosition = state.accountPosition;
            columns = state.columns;

            // Create all columns from columns object
            for (const [id, name] of Object.entries(columns)) {
                addColumn(name, id);
            }

            for (const [id, position] of Object.entries(accountPosition)) {

                // Add card to column
                const account = appState.accounts[id];
                if(account.total.toFixed(2) <= 0) continue
                const accountCard = $(`
                    <div data-id=${id} class="kanban-card card mb-2" style="cursor: grab;">
                        <div class="card-body p-2">
                            <h6 class="card-title m-0">${account.name}</h6>
                            <p class="card-text m-0">${Utils.formatCurrency(account.total)}</p>
                        </div>
                    </div>`
                );
                $(`#${position.id}`).append(accountCard);
                updateColumnBudget($(`#${position.id}`));
            }
        } else {
          addColumn('Accounts', 'accounts');
        }
        initializeBoard();

    }

    function addColumn(columnName, id) {
      const newColumn = $(`
        <div  data-name="${columnName}" class="kanban-column card p-3">
          <h4 class='column-title' contenteditable="true">${columnName}</h4>
          <span class="total-budget" data-total="0">${Utils.formatCurrency(0)}</span>
          <hr>
          <div id=${id} class="kanban-cards"></div>
        </div>
      `);

        columns[id] = columnName;

      // Add on blur event to the h4 column title to listen to contentedibale changes
        newColumn.find('.column-title').on('blur', function() {
            console.log('edited')

            // Get the sibling kanban-cards div id
            const columnId = $(this).siblings('.kanban-cards').attr('id');

            const newTitle = $(this).text();
            $(this).attr('data-name', newTitle);
            columns[columnId] = newTitle;
            saveState();
        });

      newColumn.droppable({
        accept: ".card",
        drop: function(event, ui) {
          $(this).find('.kanban-cards').append(ui.draggable);
          const droppedCard = ui.helper;
          updateColumnBudget($(this).find('.kanban-cards'), ui.draggable);
          droppedCard.remove();
          let positionId = $(this).find('.kanban-cards').attr('id');
          let positionName = $(this).attr('data-name');
          let cardId = ui.draggable.attr('data-id');
          accountPosition[cardId] = {title: positionName, id: positionId};
          if(startColumn.length == 0) startColumn = $("#accounts");
          updateColumnBudget(startColumn, ui.draggable);
          saveState();
        }
      });
      $('#kanban-board').append(newColumn);
    }


    // Update total budget for a column
    function updateColumnBudget(column, dragged = null) {
      let total = 0;
      column.find('.kanban-card').each(function() {
        total += parseInt($(this).find('.card-text').text().replace('$', ''));
      });
      column.parent().find('.total-budget').attr('data-total', total).html(Utils.formatCurrency(total));    
    }


    // Make cards draggable
    $(document).on('mouseenter', '.kanban-card', function() {
        $(this).draggable({
            revert: "invalid",
            helper: "clone",
            start: function(event, ui) {
                startColumn = $(this).closest(".kanban-cards");
                $(this).css("opacity", 0.5);
            },
            stop: function(event, ui) {
                $(this).css("opacity", 1);
            }
        });
    });


    // Add kanban column functionality
    $('#add-column-form').submit(function(e) {
      e.preventDefault();
      const columnName = $(this).find('input').val();
      addColumn(columnName, Utils.generateUUID());
      $(this).find('input').val('');
      saveState();
    });	

    let accountPosition = {}
    let columns = {}
    restoreState();
  });