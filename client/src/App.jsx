import { useCallback, useEffect, useState } from 'react';
import {
  ActionList,
  ActionListItem,
  Alert,
  AlertGroup,
  AlertVariant,
  Button,
  Form,
  FormGroup,
  Grid,
  GridItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Page,
  PageSection,
  PageSectionVariants,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import TrashIcon from '@patternfly/react-icons/dist/esm/icons/trash-icon';
import MinusCircleIcon from '@patternfly/react-icons/dist/esm/icons/minus-circle-icon';
import PlusCircleIcon from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import SearchIcon from '@patternfly/react-icons/dist/esm/icons/search-icon';
import { addFloss, listFlosses, removeFloss, subtractFloss } from './api';

const emptyFilters = { number: '', type: '', minQuantity: '' };
const emptyAddForm = { number: '', type: 'DMC', quantity: 1 };

function flossLabel(floss) {
  return `${floss.type} #${floss.number}`;
}

export function App() {
  const [flosses, setFlosses] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [subtractTarget, setSubtractTarget] = useState(null);
  const [subtractQuantity, setSubtractQuantity] = useState(1);
  const [subtractConfirmText, setSubtractConfirmText] = useState('');

  const pushAlert = useCallback((title, variant = AlertVariant.success) => {
    setAlerts((current) => [...current, { key: Date.now(), title, variant }]);
  }, []);

  const loadFlosses = useCallback(async (activeFilters = appliedFilters, notify = false) => {
    setLoading(true);
    try {
      const result = await listFlosses(activeFilters);
      setFlosses(result.data ?? []);
      if (notify) {
        pushAlert(result.message, AlertVariant.info);
      }
    } catch (error) {
      pushAlert(error.message, AlertVariant.danger);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, pushAlert]);

  useEffect(() => {
    loadFlosses(appliedFilters, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
    await loadFlosses(filters, true);
  };

  const handleClearFilters = async () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    await loadFlosses(emptyFilters, true);
  };

  const handleAddFloss = async (event) => {
    event.preventDefault();
    try {
      const result = await addFloss(addForm);
      pushAlert(result.message, AlertVariant.success);
      setAddForm(emptyAddForm);
      await loadFlosses(appliedFilters);
    } catch (error) {
      pushAlert(error.message, AlertVariant.danger);
    }
  };

  const openSubtractModal = (floss) => {
    setSubtractTarget(floss);
    setSubtractQuantity(1);
    setSubtractConfirmText('');
  };

  const handleConfirmSubtract = async () => {
    if (!subtractTarget) return;

    const depletesStock = subtractQuantity >= subtractTarget.quantity;

    try {
      const result = await subtractFloss(subtractTarget.id, subtractQuantity, depletesStock);
      pushAlert(result.message, AlertVariant.success);
      setSubtractTarget(null);
      setSubtractQuantity(1);
      setSubtractConfirmText('');
      await loadFlosses(appliedFilters);
    } catch (error) {
      pushAlert(error.message, AlertVariant.danger);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const result = await removeFloss(deleteTarget.id);
      pushAlert(result.message, AlertVariant.success);
      setDeleteTarget(null);
      setDeleteConfirmText('');
      await loadFlosses(appliedFilters);
    } catch (error) {
      pushAlert(error.message, AlertVariant.danger);
    }
  };

  const deleteConfirmationValid =
    deleteTarget && deleteConfirmText.trim().toUpperCase() === flossLabel(deleteTarget).toUpperCase();

  const subtractDepletesStock = subtractTarget && subtractQuantity >= subtractTarget.quantity;
  const subtractQuantityValid =
    subtractTarget &&
    subtractQuantity >= 1 &&
    subtractQuantity <= subtractTarget.quantity;
  const subtractConfirmationValid =
    subtractQuantityValid &&
    (!subtractDepletesStock ||
      subtractConfirmText.trim().toUpperCase() === flossLabel(subtractTarget).toUpperCase());

  return (
    <Page>
      <PageSection variant={PageSectionVariants.light}>
        <Title headingLevel="h1" size="2xl">
          Embroidery Floss Collection
        </Title>
      </PageSection>

      <PageSection>
        <AlertGroup isToast isLiveRegion>
          {alerts.map((alert) => (
            <Alert
              key={alert.key}
              variant={alert.variant}
              title={alert.title}
              timeout={5000}
              timeoutAnimation={400}
              ouiaId={`alert-${alert.key}`}
            />
          ))}
        </AlertGroup>

        <Grid hasGutter>
          <GridItem span={12} md={4}>
            <Title headingLevel="h2" size="lg">
              Add floss
            </Title>
            <Form onSubmit={handleAddFloss}>
              <FormGroup label="Number" isRequired fieldId="add-number">
                <TextInput
                  id="add-number"
                  value={addForm.number}
                  onChange={(_event, value) => setAddForm((current) => ({ ...current, number: value }))}
                  isRequired
                />
              </FormGroup>
              <FormGroup label="Type" fieldId="add-type">
                <TextInput
                  id="add-type"
                  value={addForm.type}
                  onChange={(_event, value) => setAddForm((current) => ({ ...current, type: value }))}
                  placeholder="DMC"
                />
              </FormGroup>
              <FormGroup label="Quantity" isRequired fieldId="add-quantity">
                <NumberInput
                  id="add-quantity"
                  value={addForm.quantity}
                  min={1}
                  onMinus={() =>
                    setAddForm((current) => ({
                      ...current,
                      quantity: Math.max(1, current.quantity - 1),
                    }))
                  }
                  onPlus={() =>
                    setAddForm((current) => ({
                      ...current,
                      quantity: current.quantity + 1,
                    }))
                  }
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setAddForm((current) => ({
                      ...current,
                      quantity: Number.isNaN(value) ? 1 : Math.max(1, value),
                    }));
                  }}
                />
              </FormGroup>
              <ActionList>
                <ActionListItem>
                  <Button type="submit" variant="primary" icon={<PlusCircleIcon />}>
                    Add floss
                  </Button>
                </ActionListItem>
              </ActionList>
            </Form>
          </GridItem>

          <GridItem span={12} md={8}>
            <Title headingLevel="h2" size="lg">
              Filter collection
            </Title>
            <Form onSubmit={handleApplyFilters}>
              <Grid hasGutter>
                <GridItem span={12} md={4}>
                  <FormGroup label="Number contains" fieldId="filter-number">
                    <TextInput
                      id="filter-number"
                      value={filters.number}
                      onChange={(_event, value) => setFilters((current) => ({ ...current, number: value }))}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={12} md={4}>
                  <FormGroup label="Type contains" fieldId="filter-type">
                    <TextInput
                      id="filter-type"
                      value={filters.type}
                      onChange={(_event, value) => setFilters((current) => ({ ...current, type: value }))}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={12} md={4}>
                  <FormGroup label="Minimum quantity" fieldId="filter-min-quantity">
                    <NumberInput
                      id="filter-min-quantity"
                      value={filters.minQuantity === '' ? 0 : Number(filters.minQuantity)}
                      min={0}
                      onMinus={() =>
                        setFilters((current) => ({
                          ...current,
                          minQuantity: String(Math.max(0, (Number(current.minQuantity) || 0) - 1)),
                        }))
                      }
                      onPlus={() =>
                        setFilters((current) => ({
                          ...current,
                          minQuantity: String((Number(current.minQuantity) || 0) + 1),
                        }))
                      }
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          minQuantity: event.target.value,
                        }))
                      }
                    />
                  </FormGroup>
                </GridItem>
              </Grid>
              <ActionList>
                <ActionListItem>
                  <Button type="submit" variant="secondary" icon={<SearchIcon />}>
                    Apply filters
                  </Button>
                </ActionListItem>
                <ActionListItem>
                  <Button variant="link" onClick={handleClearFilters}>
                    Clear filters
                  </Button>
                </ActionListItem>
              </ActionList>
            </Form>
          </GridItem>
        </Grid>
      </PageSection>

      <PageSection isFilled>
        <Title headingLevel="h2" size="lg">
          Your flosses
        </Title>
        <Table aria-label="Floss collection table" variant="compact">
          <Thead>
            <Tr>
              <Th>Type</Th>
              <Th>Number</Th>
              <Th>Quantity</Th>
              <Th>Updated</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {flosses.length === 0 ? (
              <Tr>
                <Td colSpan={5}>{loading ? 'Loading...' : 'No flosses match the current filters.'}</Td>
              </Tr>
            ) : (
              flosses.map((floss) => (
                <Tr key={floss.id}>
                  <Td dataLabel="Type">{floss.type}</Td>
                  <Td dataLabel="Number">{floss.number}</Td>
                  <Td dataLabel="Quantity">{floss.quantity}</Td>
                  <Td dataLabel="Updated">{floss.updated_at}</Td>
                  <Td isActionCell>
                    <ActionList>
                      <ActionListItem>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<MinusCircleIcon />}
                          onClick={() => openSubtractModal(floss)}
                        >
                          Use
                        </Button>
                      </ActionListItem>
                      <ActionListItem>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<TrashIcon />}
                          onClick={() => {
                            setDeleteTarget(floss);
                            setDeleteConfirmText('');
                          }}
                        >
                          Remove
                        </Button>
                      </ActionListItem>
                    </ActionList>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </PageSection>

      <Modal
        variant="small"
        isOpen={Boolean(subtractTarget)}
        onClose={() => {
          setSubtractTarget(null);
          setSubtractQuantity(1);
          setSubtractConfirmText('');
        }}
        aria-labelledby="subtract-floss-title"
      >
        <ModalHeader title="Use floss" labelId="subtract-floss-title" />
        <ModalBody>
          {subtractTarget && (
            <>
              <p>
                Subtract quantity from <strong>{flossLabel(subtractTarget)}</strong>. Current stock:{' '}
                {subtractTarget.quantity}.
              </p>
              <FormGroup label="Quantity to use" fieldId="subtract-quantity" isRequired>
                <NumberInput
                  id="subtract-quantity"
                  value={subtractQuantity}
                  min={1}
                  max={subtractTarget.quantity}
                  onMinus={() => setSubtractQuantity((current) => Math.max(1, current - 1))}
                  onPlus={() =>
                    setSubtractQuantity((current) => Math.min(subtractTarget.quantity, current + 1))
                  }
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    if (Number.isNaN(value)) {
                      setSubtractQuantity(1);
                      return;
                    }
                    setSubtractQuantity(Math.min(subtractTarget.quantity, Math.max(1, value)));
                  }}
                />
              </FormGroup>
              {subtractDepletesStock && (
                <FormGroup
                  label={`Type "${flossLabel(subtractTarget)}" to confirm using all remaining stock`}
                  fieldId="subtract-confirm"
                  isRequired
                >
                  <TextInput
                    id="subtract-confirm"
                    value={subtractConfirmText}
                    onChange={(_event, value) => setSubtractConfirmText(value)}
                    placeholder={flossLabel(subtractTarget)}
                  />
                </FormGroup>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            key="confirm-subtract"
            variant="primary"
            isDisabled={!subtractConfirmationValid}
            onClick={handleConfirmSubtract}
          >
            Use floss
          </Button>
          <Button
            key="cancel-subtract"
            variant="link"
            onClick={() => {
              setSubtractTarget(null);
              setSubtractQuantity(1);
              setSubtractConfirmText('');
            }}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant="small"
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteConfirmText('');
        }}
        aria-labelledby="delete-floss-title"
      >
        <ModalHeader title="Confirm removal" labelId="delete-floss-title" />
        <ModalBody>
          {deleteTarget && (
            <>
              <p>
                This will permanently remove <strong>{flossLabel(deleteTarget)}</strong> (quantity{' '}
                {deleteTarget.quantity}) from your collection, regardless of how much is left.
              </p>
              <FormGroup
                label={`Type "${flossLabel(deleteTarget)}" to confirm`}
                fieldId="delete-confirm"
                isRequired
              >
                <TextInput
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(_event, value) => setDeleteConfirmText(value)}
                  placeholder={flossLabel(deleteTarget)}
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            key="confirm"
            variant="danger"
            isDisabled={!deleteConfirmationValid}
            onClick={handleConfirmDelete}
          >
            Remove floss
          </Button>
          <Button
            key="cancel"
            variant="link"
            onClick={() => {
              setDeleteTarget(null);
              setDeleteConfirmText('');
            }}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </Page>
  );
}
